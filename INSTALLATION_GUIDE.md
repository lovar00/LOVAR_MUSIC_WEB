# 🎵 LOVAR MUSIC - Complete Installation Guide

## راهنمای نصب کامل پلتفرم LOVAR MUSIC

### 📋 System Requirements

- **Server**: Ubuntu 20.04+ or CentOS 8+ (Recommended: Ubuntu 22.04)
- **RAM**: Minimum 4GB (Recommended: 8GB+)
- **Storage**: Minimum 50GB SSD (Recommended: 100GB+ for music files)
- **CPU**: 2+ cores (Recommended: 4+ cores)
- **Network**: Static IP address with ports 80, 443, 3000, 5000 open

---

## 🚀 Step 1: Server Preparation

### 1.1 Update Your Server
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### 1.2 Install Essential Dependencies
```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install additional tools
sudo apt-get install -y git nginx certbot python3-certbot-nginx ffmpeg build-essential
```

### 1.3 Install PM2 for Process Management
```bash
sudo npm install -g pm2
```

---

## 🗄️ Step 2: Database Setup

### 2.1 Start and Configure MongoDB
```bash
# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Secure MongoDB installation
sudo mongo
```

#### Inside MongoDB shell:
```javascript
use admin
db.createUser({
  user: "admin",
  pwd: "your-strong-password-here",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

use lovar-music
db.createUser({
  user: "lovaruser",
  pwd: "your-database-password",
  roles: [{ role: "readWrite", db: "lovar-music" }]
})

exit
```

### 2.2 Enable Authentication
```bash
sudo nano /etc/mongod.conf
```

Add these lines:
```yaml
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

---

## 📦 Step 3: Download and Setup Application

### 3.1 Clone the Repository
```bash
cd /var/www
sudo git clone https://github.com/your-repo/lovar-music.git
sudo chown -R $USER:$USER lovar-music
cd lovar-music
```

### 3.2 Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3.3 Configure Environment Variables
```bash
# Copy environment template
cp .env.example .env
nano .env
```

#### Update .env file:
```env
# Database
MONGODB_URI=mongodb://lovaruser:your-database-password@localhost:27017/lovar-music

# JWT Secret (Generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-256-bit-minimum
JWT_EXPIRE=7d

# Server Configuration
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-domain.com

# File Upload
MAX_FILE_SIZE=50000000
UPLOAD_PATH=/var/www/lovar-music/uploads

# Cloudinary (for production file storage)
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# AI Recommendations (Optional)
OPENAI_API_KEY=your-openai-api-key

# Admin Credentials
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=change-this-password
```

---

## 🔧 Step 4: Build and Deploy

### 4.1 Build the Frontend
```bash
cd client
npm run build
cd ..
```

### 4.2 Create Upload Directories
```bash
mkdir -p uploads/music uploads/images uploads/videos uploads/reels
chmod 755 uploads
chmod 755 uploads/*
```

### 4.3 Create PM2 Ecosystem File
```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'lovar-music',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/lovar-music-error.log',
    out_file: '/var/log/pm2/lovar-music-out.log',
    log_file: '/var/log/pm2/lovar-music.log',
    time: true
  }]
}
```

### 4.4 Start the Application
```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🌐 Step 5: Nginx Configuration

### 5.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/lovar-music
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Static files
    location /uploads/ {
        alias /var/www/lovar-music/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React app static files
    location /static/ {
        alias /var/www/lovar-music/client/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React app
    location / {
        root /var/www/lovar-music/client/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # File upload size
    client_max_body_size 100M;
}
```

### 5.2 Enable Site and Test Configuration
```bash
sudo ln -s /etc/nginx/sites-available/lovar-music /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 6: SSL Certificate Setup

### 6.1 Obtain SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 6.2 Test Auto-renewal
```bash
sudo certbot renew --dry-run
```

---

## 🛠️ Step 7: System Optimization

### 7.1 Firewall Configuration
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 27017 # MongoDB (only if external access needed)
```

### 7.2 System Limits
```bash
sudo nano /etc/security/limits.conf
```

Add:
```
* soft nofile 65536
* hard nofile 65536
```

### 7.3 MongoDB Optimization
```bash
sudo nano /etc/mongod.conf
```

Update:
```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2  # Adjust based on your RAM
```

---

## 📊 Step 8: Monitoring Setup

### 8.1 Setup Log Rotation
```bash
sudo nano /etc/logrotate.d/lovar-music
```

```
/var/log/pm2/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 0644 your-user your-group
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 8.2 Setup System Monitoring
```bash
# Install htop for monitoring
sudo apt install htop

# Monitor PM2 processes
pm2 monit
```

---

## 🎯 Step 9: Create Admin User

### 9.1 Access MongoDB and Create Admin
```bash
mongo mongodb://lovaruser:your-database-password@localhost:27017/lovar-music
```

```javascript
db.users.insertOne({
  username: "admin",
  email: "admin@yourdomain.com",
  password: "$2a$10$your-hashed-password", // Use bcrypt to hash
  userType: "ADMIN",
  isActive: true,
  emailVerified: true,
  profile: {
    firstName: "Admin",
    lastName: "User"
  },
  createdAt: new Date(),
  updatedAt: new Date()
})
```

---

## 🔧 Step 10: Post-Installation Tasks

### 10.1 Test All Features
1. Visit `https://your-domain.com`
2. Register a new user
3. Login as admin
4. Upload test music file
5. Create playlist
6. Test reels functionality

### 10.2 Setup Backups
```bash
# Create backup script
nano /home/$USER/backup-lovar.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/$USER/backups"

mkdir -p $BACKUP_DIR

# Database backup
mongodump --uri="mongodb://lovaruser:your-database-password@localhost:27017/lovar-music" --out=$BACKUP_DIR/db_$DATE

# Files backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/lovar-music/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -type d -name "db_*" -mtime +7 -exec rm -rf {} +
```

Make executable and setup cron:
```bash
chmod +x /home/$USER/backup-lovar.sh

# Add to crontab (daily backup at 2 AM)
crontab -e
```

Add line:
```
0 2 * * * /home/$USER/backup-lovar.sh
```

---

## 🚨 Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed**
   ```bash
   sudo systemctl status mongod
   sudo tail -f /var/log/mongodb/mongod.log
   ```

2. **PM2 Process Crashed**
   ```bash
   pm2 logs lovar-music
   pm2 restart lovar-music
   ```

3. **Nginx 502 Error**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   curl http://localhost:5000/api/health
   ```

4. **File Upload Issues**
   ```bash
   ls -la /var/www/lovar-music/uploads/
   sudo chown -R www-data:www-data /var/www/lovar-music/uploads/
   ```

---

## 📈 Performance Optimization

### For High Traffic:

1. **Enable Redis Caching**
   ```bash
   sudo apt install redis-server
   # Update application to use Redis
   ```

2. **Setup Load Balancer**
   ```bash
   # Scale PM2 instances
   pm2 scale lovar-music 4
   ```

3. **CDN Integration**
   - Setup Cloudflare or AWS CloudFront
   - Configure file uploads to use cloud storage

---

## 🔐 Security Best Practices

1. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade
   npm audit fix
   ```

2. **Monitor Logs**
   ```bash
   tail -f /var/log/nginx/access.log
   pm2 logs lovar-music
   ```

3. **Backup Strategy**
   - Daily database backups
   - Weekly full system backups
   - Test restore procedures monthly

---

## 📞 Support

For technical support or issues:
- Email: support@lovarmusic.com
- Documentation: https://docs.lovarmusic.com
- GitHub Issues: https://github.com/your-repo/lovar-music/issues

---

## 🎉 Congratulations!

Your LOVAR MUSIC platform is now fully installed and ready to use!

**Default URLs:**
- Main Site: `https://your-domain.com`
- Admin Panel: `https://your-domain.com/admin`
- API Documentation: `https://your-domain.com/api/docs`

**Remember to:**
- Change default passwords
- Setup regular backups
- Monitor system resources
- Keep software updated

---

**Happy Streaming! 🎵**