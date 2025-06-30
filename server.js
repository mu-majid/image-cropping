const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/uploads', express.static('uploads'));
app.use('/cropped', express.static('cropped'));

const createDirectories = async () => {
  const dirs = ['uploads', 'cropped', 'public', 'public/css', 'public/js'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.log(`Directory ${dir} already exists or error creating:`, error.message);
    }
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and TIFF are allowed.'));
    }
  }
});

// In-memory storage for pending crops (use database in production)
let pendingCrops = new Map();
let approvedCrops = new Map();

// Predefined crop configurations
const cropPresets = {
  thumbnail: { width: 150, height: 150, fit: 'cover' },
  banner: { width: 1200, height: 400, fit: 'cover' },
  avatar: { width: 200, height: 200, fit: 'cover' },
  product: { width: 800, height: 600, fit: 'inside' },
  square: { width: 500, height: 500, fit: 'cover' },
  custom: { width: null, height: null, fit: 'cover' } // Will be set by user
};


app.get('/', async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send('Error loading dashboard');
  }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { cropType, customWidth, customHeight } = req.body;
    let cropConfig = cropPresets[cropType];

    if (!cropConfig) {
      return res.status(400).json({ error: 'Invalid crop type' });
    }

    // Handle custom dimensions
    if (cropType === 'custom') {
      if (!customWidth || !customHeight) {
        return res.status(400).json({ error: 'Custom width and height are required' });
      }
      cropConfig = {
        width: parseInt(customWidth),
        height: parseInt(customHeight),
        fit: 'cover'
      };
    }

    // Generate unique ID for this crop
    const cropId = uuidv4();
    const croppedFileName = `cropped-${cropId}${path.extname(req.file.filename)}`;
    const croppedPath = path.join('cropped', croppedFileName);

    // Process image with Sharp
    await sharp(req.file.path)
      .resize({
        width: cropConfig.width,
        height: cropConfig.height,
        fit: cropConfig.fit,
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(croppedPath);

    // Get image metadata
    const metadata = await sharp(req.file.path).metadata();
    
    // Store in pending crops
    const cropData = {
      id: cropId,
      originalPath: req.file.path,
      originalName: req.file.originalname,
      croppedPath: croppedPath,
      cropType: cropType,
      dimensions: {
        width: cropConfig.width,
        height: cropConfig.height
      },
      originalDimensions: {
        width: metadata.width,
        height: metadata.height
      },
      createdAt: new Date().toISOString()
    };

    pendingCrops.set(cropId, cropData);

    res.json({
      success: true,
      cropId: cropId,
      message: 'Image cropped successfully and pending approval'
    });

  } catch (error) {
    console.error('Upload/crop error:', error);
    res.status(500).json({ error: 'Failed to process image: ' + error.message });
  }
});

app.get('/api/pending', (req, res) => {
  const pending = Array.from(pendingCrops.values());
  res.json(pending);
});

app.get('/api/approved', (req, res) => {
  const approved = Array.from(approvedCrops.values());
  res.json(approved);
});

app.post('/api/approve/:id', async (req, res) => {
  const cropId = req.params.id;
  const cropData = pendingCrops.get(cropId);

  if (!cropData) {
    return res.status(404).json({ error: 'Crop not found' });
  }

  try {
    cropData.approvedAt = new Date().toISOString();
    approvedCrops.set(cropId, cropData);
    pendingCrops.delete(cropId);
    await fs.unlink(cropData.originalPath);
    res.json({ success: true, message: 'Crop approved successfully' });
  } 
  catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve crop' });
  }
});

app.post('/api/reject/:id', async (req, res) => {
  const cropId = req.params.id;
  const cropData = pendingCrops.get(cropId);

  if (!cropData) {
    return res.status(404).json({ error: 'Crop not found' });
  }

  try {
    await fs.unlink(cropData.originalPath);
    await fs.unlink(cropData.croppedPath);
    
    pendingCrops.delete(cropId);

    res.json({ success: true, message: 'Crop rejected and files cleaned up' });
  } 
  catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject crop' });
  }
});

app.delete('/api/delete/:id', async (req, res) => {
  const cropId = req.params.id;
  const cropData = approvedCrops.get(cropId);

  if (!cropData) {
    return res.status(404).json({ error: 'Approved crop not found' });
  }

  try {
    await fs.unlink(cropData.croppedPath);
    approvedCrops.delete(cropId);
    res.json({ success: true, message: 'Approved crop deleted successfully' });
  } 
  catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete approved crop' });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  await createDirectories();
  app.listen(PORT, () => {
    console.log(`🚀 Image Cropping Server running on http://localhost:${PORT}`);
    console.log('📁 Upload directory: ./uploads');
    console.log('✂️  Cropped images: ./cropped');
    console.log('🎛️  Admin dashboard: http://localhost:${PORT}');
  });
};

startServer().catch(console.error);

module.exports = app;