const DASHBOARD_TEMPLATE = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Image Cropping Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .upload-form { background: #f9f9f9; }
        .preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .crop-item { border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: white; }
        .crop-item img { max-width: 100%; height: auto; border-radius: 3px; }
        .btn { padding: 10px 15px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; }
        .status { padding: 10px; border-radius: 3px; margin: 10px 0; }
        .status.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .status.error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Image Cropping Dashboard</h1>
        
        <div class="section upload-form">
          <h2>Upload & Crop Images</h2>
          <form id="uploadForm" enctype="multipart/form-data">
            <div class="form-group">
              <label for="image">Select Image:</label>
              <input type="file" id="image" name="image" accept="image/*" required>
            </div>
            <div class="form-group">
              <label for="cropType">Crop Type:</label>
              <select id="cropType" name="cropType" required>
                <option value="thumbnail">Thumbnail (150x150)</option>
                <option value="banner">Banner (1200x400)</option>
                <option value="avatar">Avatar (200x200)</option>
                <option value="product">Product (800x600)</option>
                <option value="square">Square (500x500)</option>
                <option value="custom">Custom Size</option>
              </select>
            </div>
            <div id="customSizeFields" style="display: none;">
              <div class="form-group">
                <label for="customWidth">Width:</label>
                <input type="number" id="customWidth" name="customWidth" min="1">
              </div>
              <div class="form-group">
                <label for="customHeight">Height:</label>
                <input type="number" id="customHeight" name="customHeight" min="1">
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Upload & Crop</button>
          </form>
          <div id="uploadStatus"></div>
        </div>

        <div class="section">
          <h2>Pending Crops for Review</h2>
          <div id="pendingCrops" class="preview-grid">
            <p>No pending crops...</p>
          </div>
        </div>

        <div class="section">
          <h2>Approved Crops</h2>
          <div id="approvedCrops" class="preview-grid">
            <p>No approved crops...</p>
          </div>
        </div>
      </div>
      ${`
      <script>
        // Handle crop type selection
        document.getElementById('cropType').addEventListener('change', function() {
          const customFields = document.getElementById('customSizeFields');
          customFields.style.display = this.value === 'custom' ? 'block' : 'none';
        });

        // Handle form submission
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const formData = new FormData(this);
          const statusDiv = document.getElementById('uploadStatus');
          
          try {
            statusDiv.innerHTML = '<div class="status">Uploading and processing...</div>';
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
              statusDiv.innerHTML = '<div class="status success">Image uploaded and cropped successfully!</div>';
              loadPending();
              this.reset();
            } else {
              statusDiv.innerHTML = '<div class="status error">Error: ' + result.error + '</div>';
            }
          } catch (error) {
            statusDiv.innerHTML = '<div class="status error">Upload failed: ' + error.message + '</div>';
          }
        });

        // Load pending crops
        async function loadPending() {
          try {
            const response = await fetch('/api/pending');
            const pending = await response.json();
            const container = document.getElementById('pendingCrops');
            
            if (pending.length === 0) {
              container.innerHTML = '<p>No pending crops...</p>';
              return;
            }

            container.innerHTML = pending.map(item => ${`
              <div class="crop-item">
                <h4>Original: ${item.originalName}</h4>
                <p><strong>Crop Type:</strong> ${item.cropType}</p>
                <p><strong>Dimensions:</strong> ${item.dimensions.width}x${item.dimensions.height}</p>
                <img src="/${item.croppedPath}" alt="Cropped preview">
                <div style="margin-top: 10px;">
                  <button class="btn btn-success" onclick="approveCrop('${item.id}')">Approve</button>
                  <button class="btn btn-danger" onclick="rejectCrop('${item.id}')">Reject</button>
                </div>
              </div>
            `}).join('');
          } catch (error) {
            console.error('Failed to load pending crops:', error);
          }
        }

        // Load approved crops
        async function loadApproved() {
          try {
            const response = await fetch('/api/approved');
            const approved = await response.json();
            const container = document.getElementById('approvedCrops');
            
            if (approved.length === 0) {
              container.innerHTML = '<p>No approved crops...</p>';
              return;
            }

            container.innerHTML = approved.map(item => ${`
              <div class="crop-item">
                <h4>${item.originalName}</h4>
                <p><strong>Crop Type:</strong> ${item.cropType}</p>
                <p><strong>Approved:</strong> ${new Date(item.approvedAt).toLocaleString()}</p>
                <img src="/${item.croppedPath}" alt="Approved crop">
                <div style="margin-top: 10px;">
                  <a href="/${item.croppedPath}" download class="btn btn-primary">Download</a>
                </div>
              </div>
            `}).join('');
          } catch (error) {
            console.error('Failed to load approved crops:', error);
          }
        }

        // Approve crop
        async function approveCrop(id) {
          try {
            const response = await fetch(${`/api/approve/${id}`}, { method: 'POST' });
            if (response.ok) {
              loadPending();
              loadApproved();
            }
          } catch (error) {
            console.error('Failed to approve crop:', error);
          }
        }

        // Reject crop
        async function rejectCrop(id) {
          if (confirm('Are you sure you want to reject this crop?')) {
            try {
              const response = await fetch(${`/api/reject/${id}`}, { method: 'POST' });
              if (response.ok) {
                loadPending();
              }
            } catch (error) {
              console.error('Failed to reject crop:', error);
            }
          }
        }

        // Load initial data
        loadPending();
        loadApproved();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
          loadPending();
          loadApproved();
        }, 30000);
      </script>
    `}
    </body>
    </html>
  `
module.exports = {DASHBOARD_TEMPLATE}