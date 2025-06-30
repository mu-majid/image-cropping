# Image Cropping Server

A Node.js server with Sharp for automated image cropping with admin confirmation workflow.

## Setup

1. Install dependencies:
```bash
npm install express multer sharp uuid
```

2. Run the server:
```bash
node server.js
```

3. Open http://localhost:3000 for the admin dashboard

## Features

- Upload and crop images with predefined presets
- Admin approval workflow
- Sharp-based image processing
- Clean file management
- Web-based dashboard

## Crop Presets

- Thumbnail (150x150)
- Banner (1200x400)
- Avatar (200x200)
- Product (800x600)
- Square (500x500)
- Custom dimensions