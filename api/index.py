import tempfile
import os
import json
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import jsonschema

# Vercel needs the app instance exposed
app = FastAPI()

# Add CORS middleware to allow requests from our frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from src.extractors import CSVExtractor, GitHubExtractor
from src.merge import MergeEngine
from src.projector import Projector
from src.schema import CanonicalProfile

@app.post("/api/transform")
async def transform(
    csvFile: UploadFile = File(None),
    githubUrl: str = Form(None),
    config: str = Form(None)
):
    if not csvFile and not githubUrl:
        raise HTTPException(status_code=400, detail="Must provide at least one source (CSV or GitHub URL)")
    
    all_profiles = []
    
    if csvFile:
        # Save uploaded file to a temporary file
        fd, temp_path = tempfile.mkstemp(suffix=".csv")
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(await csvFile.read())
            extractor = CSVExtractor()
            all_profiles.extend(extractor.extract(temp_path))
        finally:
            os.remove(temp_path)
            
    if githubUrl:
        extractor = GitHubExtractor()
        all_profiles.extend(extractor.extract(githubUrl))
        
    merger = MergeEngine()
    merged_profiles = merger.merge(all_profiles)
    
    config_data = None
    if config:
        try:
            config_data = json.loads(config)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in config")
            
    final_output = []
    
    if config_data:
        projector = Projector(config_data)
        
        dynamic_properties = {}
        dynamic_required = []
        for f_def in config_data.get("fields", []):
            dest = f_def["path"]
            dynamic_properties[dest] = {}
            if f_def.get("required", False):
                dynamic_required.append(dest)
                
        if config_data.get("include_confidence", True):
            dynamic_properties["overall_confidence"] = {"type": "number"}
        if config_data.get("include_provenance", True):
            dynamic_properties["provenance"] = {"type": "array"}
            
        dynamic_schema = {
            "type": "object",
            "properties": dynamic_properties,
            "required": dynamic_required
        }
        
        for p in merged_profiles:
            try:
                projected = projector.project(p)
                jsonschema.validate(instance=projected, schema=dynamic_schema)
                final_output.append(projected)
            except Exception as e:
                pass # Skip failed projections in API response for simplicity
    else:
        final_output = [p.model_dump() for p in merged_profiles]
        
    return JSONResponse(content={"profiles": final_output})

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
