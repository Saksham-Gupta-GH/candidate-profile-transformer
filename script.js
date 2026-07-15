document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('transformForm');
    const csvFileInput = document.getElementById('csvFile');
    const fileNameDisplay = document.getElementById('fileName');
    const dropZone = document.getElementById('dropZone');
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.getElementById('loader');
    
    const resultContainer = document.getElementById('resultContainer');
    const jsonOutput = document.getElementById('jsonOutput');
    const copyBtn = document.getElementById('copyBtn');

    // Field configuration mapping
    const fieldMapping = {
        'full_name': { path: 'full_name', type: 'string', required: true },
        'primary_email': { path: 'primary_email', from: 'emails[0]', type: 'string', required: true },
        'phone': { path: 'phone', from: 'phones[0]', type: 'string', normalize: 'E164' },
        'location': { path: 'location', from: 'location.country', type: 'string' },
        'skills': { path: 'skills', from: 'skills[*].name', type: 'string[]', normalize: 'canonical' },
        'experience': { path: 'experience', type: 'array' },
        'links': { path: 'links', type: 'object' },
        'headline': { path: 'headline', type: 'string' }
    };

    // Handle File Input Change
    csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            fileNameDisplay.style.color = 'var(--text-main)';
            dropZone.style.borderColor = 'var(--text-main)';
            dropZone.style.backgroundColor = '#F7F7F7';
        } else {
            fileNameDisplay.innerHTML = 'Drag your CSV here, or <span class="text-link">browse</span>';
            fileNameDisplay.style.color = '';
            dropZone.style.borderColor = '';
            dropZone.style.backgroundColor = '';
        }
    });

    // Handle Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            csvFileInput.files = e.dataTransfer.files;
            const event = new Event('change');
            csvFileInput.dispatchEvent(event);
        }
    });

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const hasFile = formData.get('csvFile').size > 0;
        const hasGithub = formData.get('githubUrl').trim() !== '';

        if (!hasFile && !hasGithub) {
            alert('Please provide either a CSV file or a GitHub URL.');
            return;
        }

        // Build Config JSON from Checkboxes
        const checkboxes = document.querySelectorAll('input[name="configField"]:checked');
        const selectedFields = [];
        
        checkboxes.forEach(cb => {
            if (fieldMapping[cb.value]) {
                selectedFields.push(fieldMapping[cb.value]);
            }
        });

        const configObject = {
            fields: selectedFields,
            include_confidence: true,
            on_missing: 'null'
        };

        formData.set('config', JSON.stringify(configObject));

        // UI Loading State
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'block';
        resultContainer.style.display = 'none';

        try {
            const response = await fetch('/api/transform', {
                method: 'POST',
                body: formData
            });

            // Handle potential HTML error pages from server
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'An error occurred during transformation');
                }

                jsonOutput.textContent = JSON.stringify(data.profiles, null, 2);
                resultContainer.style.display = 'block';
                resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                throw new Error("Server returned a non-JSON response. Ensure Vercel routing is configured correctly.");
            }

        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            // Reset UI State
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    });

    // Handle Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(jsonOutput.textContent).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    });
});
