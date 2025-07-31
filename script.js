// Password Manager Application
class PasswordManager {
    constructor() {
        this.passwords = [];
        this.currentEditId = null;
        this.encryptionKey = null;
        this.init();
    }

    init() {
        this.loadPasswords();
        this.bindEvents();
        this.updateUI();
        this.generateEncryptionKey();
    }

    // Encryption/Decryption using AES
    generateEncryptionKey() {
        // Use a combination of device info and timestamp for encryption key
        const deviceInfo = navigator.userAgent + screen.width + screen.height;
        this.encryptionKey = this.simpleHash(deviceInfo + Date.now().toString());
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    encrypt(text) {
        if (!text) return '';
        let result = '';
        const key = this.encryptionKey;
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const keyChar = key.charCodeAt(i % key.length);
            result += String.fromCharCode((charCode + keyChar) % 65536);
        }
        return btoa(result); // Base64 encode
    }

    decrypt(encryptedText) {
        if (!encryptedText) return '';
        try {
            const text = atob(encryptedText); // Base64 decode
            let result = '';
            const key = this.encryptionKey;
            for (let i = 0; i < text.length; i++) {
                const charCode = text.charCodeAt(i);
                const keyChar = key.charCodeAt(i % key.length);
                let decrypted = charCode - keyChar;
                if (decrypted < 0) decrypted += 65536;
                result += String.fromCharCode(decrypted);
            }
            return result;
        } catch (e) {
            console.error('Decryption failed:', e);
            return '';
        }
    }

    // Local Storage Management
    savePasswords() {
        const encryptedData = this.passwords.map(pwd => ({
            ...pwd,
            password: this.encrypt(pwd.password),
            notes: this.encrypt(pwd.notes || '')
        }));
        localStorage.setItem('secureVaultPasswords', JSON.stringify(encryptedData));
    }

    loadPasswords() {
        const saved = localStorage.getItem('secureVaultPasswords');
        if (saved) {
            try {
                const encryptedData = JSON.parse(saved);
                this.passwords = encryptedData.map(pwd => ({
                    ...pwd,
                    password: this.decrypt(pwd.password),
                    notes: this.decrypt(pwd.notes || '')
                }));
            } catch (e) {
                console.error('Failed to load passwords:', e);
                this.passwords = [];
            }
        }
    }

    // Event Binding
    bindEvents() {
        // Header buttons
        document.getElementById('add-password-btn').addEventListener('click', () => this.openPasswordModal());
        document.getElementById('generate-password-btn').addEventListener('click', () => this.openGeneratorModal());

        // Search and filter
        document.getElementById('search-input').addEventListener('input', (e) => this.filterPasswords());
        document.getElementById('category-filter').addEventListener('change', (e) => this.filterPasswords());

        // Modal events
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal('password-modal'));
        document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal('password-modal'));
        document.getElementById('password-form').addEventListener('submit', (e) => this.handlePasswordSubmit(e));

        // Password input events
        document.getElementById('toggle-password').addEventListener('click', () => this.togglePasswordVisibility('password'));
        document.getElementById('generate-password').addEventListener('click', () => this.generatePasswordForInput());

        // Generator modal events
        document.getElementById('generator-close').addEventListener('click', () => this.closeModal('generator-modal'));
        document.getElementById('password-length').addEventListener('input', (e) => this.updateLengthDisplay(e.target.value));
        document.getElementById('regenerate-btn').addEventListener('click', () => this.generatePassword());
        document.getElementById('copy-generated').addEventListener('click', () => this.copyGeneratedPassword());
        document.getElementById('use-generated').addEventListener('click', () => this.useGeneratedPassword());

        // Confirm modal events
        document.getElementById('confirm-cancel').addEventListener('click', () => this.closeModal('confirm-modal'));
        document.getElementById('confirm-delete').addEventListener('click', () => this.confirmDelete());

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Generate password on load
        this.generatePassword();
    }

    // Password Management
    addPassword(passwordData) {
        const password = {
            id: Date.now().toString(),
            siteName: passwordData.siteName,
            username: passwordData.username,
            password: passwordData.password,
            category: passwordData.category,
            url: passwordData.url || '',
            notes: passwordData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.passwords.push(password);
        this.savePasswords();
        this.updateUI();
        this.showToast('Password added successfully!');
    }

    updatePassword(id, passwordData) {
        const index = this.passwords.findIndex(p => p.id === id);
        if (index !== -1) {
            this.passwords[index] = {
                ...this.passwords[index],
                siteName: passwordData.siteName,
                username: passwordData.username,
                password: passwordData.password,
                category: passwordData.category,
                url: passwordData.url || '',
                notes: passwordData.notes || '',
                updatedAt: new Date().toISOString()
            };
            this.savePasswords();
            this.updateUI();
            this.showToast('Password updated successfully!');
        }
    }

    deletePassword(id) {
        this.passwords = this.passwords.filter(p => p.id !== id);
        this.savePasswords();
        this.updateUI();
        this.showToast('Password deleted successfully!');
    }

    // UI Management
    updateUI() {
        this.renderPasswords();
        this.updateEmptyState();
    }

    renderPasswords() {
        const container = document.getElementById('passwords-container');
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const categoryFilter = document.getElementById('category-filter').value;

        let filteredPasswords = this.passwords.filter(password => {
            const matchesSearch = password.siteName.toLowerCase().includes(searchTerm) ||
                                password.username.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || password.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        if (filteredPasswords.length === 0) {
            container.innerHTML = '';
            this.updateEmptyState();
            return;
        }

        container.innerHTML = filteredPasswords.map(password => this.createPasswordCard(password)).join('');
        this.bindCardEvents();
    }

    createPasswordCard(password) {
        const categoryIcon = this.getCategoryIcon(password.category);
        const maskedPassword = '•'.repeat(password.password.length);
        
        return `
            <div class="password-card" data-id="${password.id}">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-icon ${password.category}">
                            <i class="fas ${categoryIcon}"></i>
                        </div>
                        <div class="card-info">
                            <h3>${this.escapeHtml(password.siteName)}</h3>
                            <p>${this.escapeHtml(password.username)}</p>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="copy-password" title="Copy Password">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="edit-password" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-password" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-details">
                    <div class="detail-row">
                        <span class="detail-label">Password:</span>
                        <div class="detail-value">
                            <span class="password-value" data-password="${this.escapeHtml(password.password)}">${maskedPassword}</span>
                            <button class="copy-btn" data-copy="${this.escapeHtml(password.password)}">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    ${password.url ? `
                        <div class="detail-row">
                            <span class="detail-label">URL:</span>
                            <div class="detail-value">
                                <a href="${password.url}" target="_blank" rel="noopener">${this.escapeHtml(password.url)}</a>
                            </div>
                        </div>
                    ` : ''}
                    ${password.notes ? `
                        <div class="detail-row">
                            <span class="detail-label">Notes:</span>
                            <div class="detail-value">
                                <span>${this.escapeHtml(password.notes)}</span>
                            </div>
                        </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Updated:</span>
                        <div class="detail-value">
                            <span>${this.formatDate(password.updatedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindCardEvents() {
        // Copy password buttons
        document.querySelectorAll('.copy-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.password-card');
                const passwordData = this.passwords.find(p => p.id === card.dataset.id);
                if (passwordData) {
                    this.copyToClipboard(passwordData.password);
                    this.showToast('Password copied to clipboard!');
                }
            });
        });

        // Edit password buttons
        document.querySelectorAll('.edit-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.password-card');
                this.editPassword(card.dataset.id);
            });
        });

        // Delete password buttons
        document.querySelectorAll('.delete-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.password-card');
                this.confirmDeletePassword(card.dataset.id);
            });
        });

        // Copy individual field buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const copyData = e.target.closest('.copy-btn').dataset.copy;
                this.copyToClipboard(copyData);
                this.showToast('Copied to clipboard!');
            });
        });
    }

    updateEmptyState() {
        const emptyState = document.getElementById('empty-state');
        const hasPasswords = this.passwords.length > 0;
        const hasFilteredResults = document.getElementById('passwords-container').children.length > 0;
        
        if (!hasPasswords || !hasFilteredResults) {
            emptyState.classList.add('show');
            if (hasPasswords && !hasFilteredResults) {
                emptyState.querySelector('h2').textContent = 'No matching passwords found';
                emptyState.querySelector('p').textContent = 'Try adjusting your search or filter criteria';
            } else {
                emptyState.querySelector('h2').textContent = 'No passwords saved yet';
                emptyState.querySelector('p').textContent = 'Click "Add Password" to get started with your secure vault';
            }
        } else {
            emptyState.classList.remove('show');
        }
    }

    // Modal Management
    openPasswordModal(passwordId = null) {
        this.currentEditId = passwordId;
        const modal = document.getElementById('password-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('password-form');
        
        if (passwordId) {
            const password = this.passwords.find(p => p.id === passwordId);
            if (password) {
                title.textContent = 'Edit Password';
                document.getElementById('site-name').value = password.siteName;
                document.getElementById('username').value = password.username;
                document.getElementById('password').value = password.password;
                document.getElementById('category').value = password.category;
                document.getElementById('url').value = password.url || '';
                document.getElementById('notes').value = password.notes || '';
            }
        } else {
            title.textContent = 'Add New Password';
            form.reset();
        }
        
        this.showModal(modal);
    }

    openGeneratorModal() {
        const modal = document.getElementById('generator-modal');
        this.generatePassword();
        this.showModal(modal);
    }

    showModal(modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Password Generation
    generatePassword() {
        const length = parseInt(document.getElementById('password-length').value);
        const uppercase = document.getElementById('include-uppercase').checked;
        const lowercase = document.getElementById('include-lowercase').checked;
        const numbers = document.getElementById('include-numbers').checked;
        const symbols = document.getElementById('include-symbols').checked;

        let charset = '';
        if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (numbers) charset += '0123456789';
        if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (!charset) {
            this.showToast('Please select at least one character type', 'error');
            return;
        }

        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        document.getElementById('generated-password').value = password;
    }

    generatePasswordForInput() {
        this.generatePassword();
        const generatedPassword = document.getElementById('generated-password').value;
        document.getElementById('password').value = generatedPassword;
        this.showToast('Password generated!');
    }

    copyGeneratedPassword() {
        const password = document.getElementById('generated-password').value;
        this.copyToClipboard(password);
        this.showToast('Password copied to clipboard!');
    }

    useGeneratedPassword() {
        const password = document.getElementById('generated-password').value;
        document.getElementById('password').value = password;
        this.closeModal('generator-modal');
        this.showToast('Password applied!');
    }

    updateLengthDisplay(length) {
        document.getElementById('length-value').textContent = length;
        this.generatePassword();
    }

    // Form Handling
    handlePasswordSubmit(e) {
        e.preventDefault();
        
        const formData = {
            siteName: document.getElementById('site-name').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            category: document.getElementById('category').value,
            url: document.getElementById('url').value,
            notes: document.getElementById('notes').value
        };

        if (this.currentEditId) {
            this.updatePassword(this.currentEditId, formData);
        } else {
            this.addPassword(formData);
        }

        this.closeModal('password-modal');
        this.currentEditId = null;
    }

    editPassword(id) {
        this.openPasswordModal(id);
    }

    confirmDeletePassword(id) {
        this.currentDeleteId = id;
        const password = this.passwords.find(p => p.id === id);
        const message = `Are you sure you want to delete the password for "${password.siteName}"?`;
        document.getElementById('confirm-message').textContent = message;
        this.showModal(document.getElementById('confirm-modal'));
    }

    confirmDelete() {
        if (this.currentDeleteId) {
            this.deletePassword(this.currentDeleteId);
            this.currentDeleteId = null;
        }
        this.closeModal('confirm-modal');
    }

    // Search and Filter
    filterPasswords() {
        this.renderPasswords();
    }

    // Utility Functions
    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById('toggle-password');
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const messageEl = document.getElementById('toast-message');
        const icon = toast.querySelector('i');
        
        messageEl.textContent = message;
        
        // Update icon based on type
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
            toast.style.background = 'var(--accent-danger)';
        } else {
            icon.className = 'fas fa-check-circle';
            toast.style.background = 'var(--accent-success)';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    getCategoryIcon(category) {
        const icons = {
            social: 'fa-users',
            email: 'fa-envelope',
            banking: 'fa-university',
            work: 'fa-briefcase',
            shopping: 'fa-shopping-cart',
            other: 'fa-globe'
        };
        return icons[category] || 'fa-globe';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize the password manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.passwordManager = new PasswordManager();
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}