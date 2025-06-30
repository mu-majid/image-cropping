// Dashboard JavaScript for Image Cropping Server
class ImageCroppingDashboard {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // Handle crop type selection
    const cropTypeSelect = document.getElementById('cropType');
    const customFields = document.getElementById('customSizeFields');
    
    cropTypeSelect.addEventListener('change', function() {
      customFields.style.display = this.value === 'custom' ? 'block' : 'none';
    });

    // Handle form submission
    const uploadForm = document.getElementById('uploadForm');
    uploadForm.addEventListener('submit', this.handleFormSubmission.bind(this));
  }

  async handleFormSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const statusDiv = document.getElementById('uploadStatus');
    
    try {
      // Show loading state
      statusDiv.innerHTML = `
        <div class="status">
          <span class="loading"></span>
          Uploading and processing image...
        </div>
      `;
      
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        statusDiv.innerHTML = `
          <div class="status success">
            ✅ Image uploaded and cropped successfully! Pending admin approval.
          </div>
        `;
        this.loadPending();
        e.target.reset();
        
        // Hide custom fields if form is reset
        document.getElementById('customSizeFields').style.display = 'none';
      } else {
        statusDiv.innerHTML = `
          <div class="status error">
            ❌ Error: ${result.error}
          </div>
        `;
      }
    } catch (error) {
      statusDiv.innerHTML = `
        <div class="status error">
          ❌ Upload failed: ${error.message}
        </div>
      `;
    }
  }

  async loadPending() {
    try {
      const response = await fetch('/api/pending');
      const pending = await response.json();
      const container = document.getElementById('pendingCrops');
      
      if (pending.length === 0) {
        container.innerHTML = '<p>📂 No pending crops...</p>';
        return;
      }

      container.innerHTML = pending.map(item => `
        <div class="crop-item" data-crop-id="${item.id}">
          <h4>📄 ${this.escapeHtml(item.originalName || 'Unknown')}</h4>
          <p><strong>Crop Type:</strong> ${this.escapeHtml(item.cropType || 'Unknown')}</p>
          <p><strong>Dimensions:</strong> ${item.dimensions?.width || 0} × ${item.dimensions?.height || 0}px</p>
          <p><strong>Original Size:</strong> ${item.originalDimensions?.width || 0} × ${item.originalDimensions?.height || 0}px</p>
          <p><strong>Created:</strong> ${item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown'}</p>
          <img src="/${item.croppedPath}" alt="Cropped preview" style="max-width: 100%; height: auto;" loading="lazy">
          <div style="margin-top: 15px;">
            <button class="btn btn-success" onclick="dashboard.approveCrop('${item.id}')">
              ✅ Approve
            </button>
            <button class="btn btn-danger" onclick="dashboard.rejectCrop('${item.id}')">
              ❌ Reject
            </button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Failed to load pending crops:', error);
      document.getElementById('pendingCrops').innerHTML = `
        <p style="color: #dc3545;">❌ Failed to load pending crops. Please refresh the page.</p>
      `;
    }
  }

  async loadApproved() {
    try {
      const response = await fetch('/api/approved');
      const approved = await response.json();
      const container = document.getElementById('approvedCrops');
      
      if (approved.length === 0) {
        container.innerHTML = '<p>📂 No approved crops...</p>';
        return;
      }

      container.innerHTML = approved.map(item => `
        <div class="crop-item" data-crop-id="${item.id}">
          <h4>✅ ${this.escapeHtml(item.originalName || 'Unknown')}</h4>
          <p><strong>Crop Type:</strong> ${this.escapeHtml(item.cropType || 'Unknown')}</p>
          <p><strong>Dimensions:</strong> ${item.dimensions?.width || 0} × ${item.dimensions?.height || 0}px</p>
          <p><strong>Approved:</strong> ${item.approvedAt ? new Date(item.approvedAt).toLocaleString() : 'Unknown'}</p>
          <img src="/${item.croppedPath}" alt="Approved crop" style="max-width: 100%; height: auto;" loading="lazy">
          <div style="margin-top: 15px;">
            <a href="/${item.croppedPath}" download class="btn btn-primary">
              📥 Download
            </a>
            <button class="btn btn-danger" onclick="dashboard.deleteApproved('${item.id}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Failed to load approved crops:', error);
      document.getElementById('approvedCrops').innerHTML = `
        <p style="color: #dc3545;">❌ Failed to load approved crops. Please refresh the page.</p>
      `;
    }
  }

  async approveCrop(id) {
    if (!id) {
      alert('❌ Invalid crop ID');
      return;
    }

    try {
      // Show loading state
      const cropElement = document.querySelector(`[data-crop-id="${id}"]`);
      if (cropElement) {
        cropElement.style.opacity = '0.6';
        cropElement.style.pointerEvents = 'none';
      }

      const response = await fetch(`/api/approve/${id}`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Show success message
        this.showNotification('✅ Crop approved successfully!', 'success');
        await this.loadPending();
        await this.loadApproved();
      } else {
        throw new Error(result.error || 'Failed to approve crop');
      }
    } catch (error) {
      console.error('Failed to approve crop:', error);
      this.showNotification(`❌ Failed to approve crop: ${error.message}`, 'error');
      
      // Restore element state
      const cropElement = document.querySelector(`[data-crop-id="${id}"]`);
      if (cropElement) {
        cropElement.style.opacity = '1';
        cropElement.style.pointerEvents = 'auto';
      }
    }
  }

  async rejectCrop(id) {
    if (!id) {
      alert('❌ Invalid crop ID');
      return;
    }

    if (!confirm('⚠️ Are you sure you want to reject this crop? This action cannot be undone.')) {
      return;
    }

    try {
      // Show loading state
      const cropElement = document.querySelector(`[data-crop-id="${id}"]`);
      if (cropElement) {
        cropElement.style.opacity = '0.6';
        cropElement.style.pointerEvents = 'none';
      }

      const response = await fetch(`/api/reject/${id}`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.showNotification('✅ Crop rejected and files cleaned up', 'success');
        await this.loadPending();
      } else {
        throw new Error(result.error || 'Failed to reject crop');
      }
    } catch (error) {
      console.error('Failed to reject crop:', error);
      this.showNotification(`❌ Failed to reject crop: ${error.message}`, 'error');
      
      // Restore element state
      const cropElement = document.querySelector(`[data-crop-id="${id}"]`);
      if (cropElement) {
        cropElement.style.opacity = '1';
        cropElement.style.pointerEvents = 'auto';
      }
    }
  }

  async deleteApproved(id) {
    if (!id) {
      alert('❌ Invalid crop ID');
      return;
    }

    if (!confirm('⚠️ Are you sure you want to delete this approved crop? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/delete/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.showNotification('✅ Approved crop deleted successfully', 'success');
        await this.loadApproved();
      } else {
        throw new Error(result.error || 'Failed to delete crop');
      }
    } catch (error) {
      console.error('Failed to delete approved crop:', error);
      this.showNotification(`❌ Failed to delete crop: ${error.message}`, 'error');
    }
  }

  showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `status ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
      animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  loadInitialData() {
    this.loadPending();
    this.loadApproved();
  }

  startAutoRefresh() {
    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.loadPending();
      this.loadApproved();
    }, 30000);
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.dashboard = new ImageCroppingDashboard();
});

// Global error handler
window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
});

// Handle offline/online events
window.addEventListener('offline', function() {
  dashboard.showNotification('⚠️ You are offline. Some features may not work.', 'error');
});

window.addEventListener('online', function() {
  dashboard.showNotification('✅ Connection restored!', 'success');
  dashboard.loadInitialData();
});