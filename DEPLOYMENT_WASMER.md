# Deploy GCash Vendo Machine to Wasmer.io

## Prerequisites

- Wasmer account (<https://wasmer.io>)
- Git repository with the code
- Production API keys for Xendit and Google Gemini

## Deployment Steps

### 1. Prepare Your Repository

Make sure your repository contains:

- `wasmer.toml` configuration file
- `Dockerfile` for containerization
- Backend source code in `backend/` directory
- Production environment variables

### 2. Configure Environment Variables
Update the `.env.production` file with your actual API keys:

- Xendit production keys
- Google Gemini API keys
- Project ID and location

### 3. Deploy to Wasmer
1. Go to <https://wasmer.io/new>
2. Connect your Git repository
3. Select the repository containing this code
4. Wasmer will automatically detect the `wasmer.toml` configuration
5. Configure environment variables in the Wasmer dashboard
6. Click "Deploy"

### 4. Post-Deployment Configuration
- Set up custom domain if needed
- Configure SSL certificates (handled automatically by Wasmer)
- Monitor logs in the Wasmer dashboard
- Set up monitoring and alerts

### 5. Testing the Deployment
Once deployed, your application will be available at:

`https://your-app-name.wasmer.app`

Test the following endpoints:

- `GET /` - Main application
- `GET /demo.html` - Demo interface
- `POST /api/payments/create` - Payment creation
- `POST /api/classify` - Bill classification

### 6. Cloud Deployment Considerations
- Serial communication is disabled (`SERIAL_AUTOCONNECT=0`)
- Database uses SQLite file storage in `/app/data`
- Static files served from `/app/public`
- WebSocket connections supported for real-time updates

### 7. Troubleshooting
- Check Wasmer dashboard logs for any errors
- Verify all environment variables are set correctly
- Ensure API keys have proper permissions
- Monitor resource usage and scaling needs

## Environment Variables Required
- `XENDIT_SECRET_KEY` - Xendit production secret key
- `XENDIT_CALLBACK_TOKEN` - Xendit callback token
- `GOOGLE_API_KEY` - Google Cloud API key
- `GEMINI_API_KEY` - Gemini API key
- `GEMINI_API_SECRET` - Gemini API secret
- `GEMINI_API_PROJECT_ID` - Google Cloud project ID

## Security Notes
- Never commit actual API keys to your repository
- Use Wasmer's environment variable management
- Enable HTTPS (automatic on Wasmer)
- Regularly rotate API keys
- Monitor for unauthorized access
