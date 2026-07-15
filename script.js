document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('transformForm');
    const csvFileInput = document.getElementById('csvFile');
    const fileNameDisplay = document.getElementById('fileName');
    const dropZone = document.getElementById('dropZone');
    
    const useConfigToggle = document.getElementById('useConfigToggle');
    const configGroup = document.getElementById('configGroup');
    const configJson = document.getElementById('configJson');
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.getElementById('loader');
    
    const resultContainer = document.getElementById('resultContainer');
    const jsonOutput = document.getElementById('jsonOutput');
    const copyBtn = document.getElementById('copyBtn');

    // Handle File Input Change
    csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            fileNameDisplay.style.color = 'var(--text-main)';
        } else {
            fileNameDisplay.textContent = 'Drag & drop or click to upload CSV';
            fileNameDisplay.style.color = 'var(--text-muted)';
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
            // Trigger change event
            const event = new Event('change');
            csvFileInput.dispatchEvent(event);
        }
    });

    // Handle Config Toggle
    useConfigToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            configGroup.style.display = 'block';
        } else {
            configGroup.style.display = 'none';
            configJson.value = '';
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

        // Validate JSON if provided
        if (useConfigToggle.checked) {
            try {
                const configVal = formData.get('configJson');
                if (configVal.trim() !== '') {
                    JSON.parse(configVal);
                }
            } catch (err) {
                alert('Invalid JSON in projection config.');
                return;
            }
        } else {
            formData.delete('configJson');
        }

        // UI Loading State
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'block';
        resultContainer.style.display = 'none';

        try {
            // Using a relative path so it works seamlessly on Vercel
            const response = await fetch('/api/transform', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An error occurred during transformation');
            }

            jsonOutput.textContent = JSON.stringify(data.profiles, null, 2);
            resultContainer.style.display = 'block';
            
            // Scroll to results
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
