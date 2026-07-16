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
    const viewVisualBtn = document.getElementById('viewVisualBtn');
    const viewJsonBtn = document.getElementById('viewJsonBtn');
    const visualView = document.getElementById('visualView');
    const jsonView = document.getElementById('jsonView');

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

    // If form is not on this page, stop here (e.g. on index.html)
    if (!form) return;

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
                renderVisualView(data.profiles);
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

    // Tab Switching
    viewVisualBtn.addEventListener('click', (e) => {
        e.preventDefault();
        viewVisualBtn.classList.add('active');
        viewJsonBtn.classList.remove('active');
        visualView.style.display = 'block';
        jsonView.style.display = 'none';
    });

    viewJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        viewJsonBtn.classList.add('active');
        viewVisualBtn.classList.remove('active');
        jsonView.style.display = 'block';
        visualView.style.display = 'none';
    });

    // Render Visual View
    function renderVisualView(profiles) {
        visualView.innerHTML = '';
        if (!profiles || profiles.length === 0) {
            visualView.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No candidates generated.</p>';
            return;
        }

        profiles.forEach(p => {
            const card = document.createElement('div');
            card.className = 'candidate-card';

            let html = `<div class="candidate-header">
                            <div>
                                <div class="candidate-name">${p.full_name || 'Unknown Candidate'}</div>
                                ${p.headline ? `<div class="candidate-headline">${p.headline}</div>` : ''}
                            </div>
                        </div>`;

            // Contact Info
            if (p.primary_email || p.phone || p.location) {
                html += `<div class="candidate-contact">`;
                if (p.primary_email) {
                    html += `<div class="contact-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <span>${p.primary_email}</span>
                             </div>`;
                }
                if (p.phone) {
                    html += `<div class="contact-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                <span>${p.phone}</span>
                             </div>`;
                }
                if (p.location && typeof p.location === 'string') {
                    html += `<div class="contact-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>${p.location}</span>
                             </div>`;
                }
                if (p.links && p.links.github) {
                    html += `<div class="contact-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                <a href="${p.links.github}" target="_blank" class="text-link">GitHub</a>
                             </div>`;
                }
                html += `</div>`;
            }

            // Skills
            if (p.skills && p.skills.length > 0) {
                html += `<div class="candidate-section">
                            <div class="candidate-section-title">Skills</div>
                            <div class="skills-container">
                                ${p.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                            </div>
                         </div>`;
            }

            // Experience
            if (p.experience && p.experience.length > 0) {
                html += `<div class="candidate-section">
                            <div class="candidate-section-title">Experience</div>
                            <ul class="experience-list">
                                ${p.experience.map(exp => `
                                    <li class="experience-item">
                                        <div class="exp-title">${exp.title}</div>
                                        <div class="exp-company">${exp.company}</div>
                                        <div class="exp-date">${exp.start || 'Unknown'} - ${exp.end || 'Present'}</div>
                                    </li>
                                `).join('')}
                            </ul>
                         </div>`;
            }

            card.innerHTML = html;
            visualView.appendChild(card);
        });
    }
});
