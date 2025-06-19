require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRoutes = require('./routes/auth.routes');
const playerRoutes = require('./routes/player.routes');
const scoutRoutes = require('./routes/scout.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const { getApiUrl } = require('./utils/url.util');

const app = express();

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pharaohs API',
      version: '1.0.0',
      description: 'API documentation for Pharaohs application',
      contact: {
        name: 'API Support',
        email: 'support@pharaohs.com'
      }
    },
    servers: [
      {
        url: getApiUrl(),
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token in the format: Bearer <token>'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'API endpoints for authentication'
      },
      {
        name: 'Player',
        description: 'API endpoints for player functionality'
      },
      {
        name: 'Scout',
        description: 'API endpoints for scout functionality'
      },
      {
        name: 'Admin',
        description: 'API endpoints for admin functionality'
      },
      {
        name: 'Videos',
        description: 'API endpoints for video management'
      },
      {
        name: 'Invitations',
        description: 'API endpoints for tryout invitations'
      },
      {
        name: 'Tryouts',
        description: 'API endpoints for tryouts'
      },
      {
        name: 'Stats',
        description: 'API endpoints for player statistics'
      },
      {
        name: 'Notifications',
        description: 'API endpoints for notifications'
      }
    ]
  },
  apis: [
    './src/routes/*.js', 
    './src/models/*.js',
    './src/controllers/*.js',
    './src/middlewares/*.js',
    './src/config/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Pharaohs API Documentation'
}));

// Configure CORS with more specific settings
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Add CORS headers for media files specifically
app.use('/uploads/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.use('/uploads/videos', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// No need for local file serving as all files are now stored in Cloudinary

// Add fallback handlers for old image/video paths
// This redirects any requests for local files to default Cloudinary images with proper CORS headers
app.get('/uploads/images/:filename', (req, res) => {
  // Set CORS headers explicitly for images
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Handle local files that may exist in the uploads directory
  const localPath = path.join(__dirname, '..', 'uploads', 'images', req.params.filename);
  if (require('fs').existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  
  // Otherwise, use Cloudinary fallbacks
  const defaultImages = {
    'player_profile.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/profiles/default_profile',
    'player_action.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/default_action',
    'team_logo.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/team_logo',
    'stadium_cairo.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/stadium_cairo'
  };

  const imageUrl = defaultImages[req.params.filename] || 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/profiles/default_profile';
  res.redirect(imageUrl);
});

app.get('/uploads/videos/:filename', (req, res) => {
  // Set CORS headers explicitly for videos
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Handle local files that may exist in the uploads directory
  const localPath = path.join(__dirname, '..', 'uploads', 'videos', req.params.filename);
  if (require('fs').existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  
  // Redirect to a default video in Cloudinary
  res.redirect('https://res.cloudinary.com/dk0szadna/video/upload/v1/pharaohs/videos/default_video');
});

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Root route for healthchecks
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Pharaohs API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/scout', scoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});