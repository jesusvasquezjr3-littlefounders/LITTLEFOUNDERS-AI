# Operations Dashboard

A beautiful startup operations dashboard with user authentication, built with React, TypeScript, Tailwind CSS, and FastAPI.

## ✨ Features

### Frontend
- **Modern UI Design**: Beautiful, responsive design using Tailwind CSS and shadcn/ui components
- **Authentication Pages**: Welcome, login, and register pages with consistent design
- **Operations Dashboard**: Comprehensive dashboard with KPIs, charts, and analytics
- **Responsive Layout**: Works seamlessly across desktop and mobile devices

### Backend
- **FastAPI Backend**: Modern, fast API with automatic documentation
- **User Authentication**: Registration and login with password hashing
- **File-based Storage**: User data stored in `users.txt` for simplicity
- **CORS Enabled**: Ready for frontend integration

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Start Both Frontend and Backend
```bash
npm run start:all
```

This will start:
- Frontend development server on `http://localhost:5173`
- Backend API server on `http://localhost:8000`

### Alternative: Start Separately

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run backend
```

## 📱 Usage

1. **Welcome Page**: Visit `http://localhost:5173/welcome` to see the landing page
2. **Register**: Create a new account at `/register`
3. **Login**: Sign in at `/login` with your credentials
4. **Dashboard**: Access the main dashboard at `/` after logging in

### Demo Account
- Email: `admin@example.com`
- Password: `password123`

## 🛠 API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Authentication Endpoints
- `POST /auth/register` - Create a new user account
- `POST /auth/login` - Sign in with email and password
- `GET /auth/users` - Get all users (development only)

## 🎨 Design System

The application uses a consistent design system with:
- **Color Palette**: Custom colors for revenue, customers, product, and team metrics
- **Typography**: Modern font hierarchy with proper spacing
- **Components**: Reusable UI components from shadcn/ui
- **Gradients**: Beautiful gradient backgrounds and buttons
- **Icons**: Lucide React icons throughout

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── dashboard/      # Dashboard components
│   │   └── ui/            # Reusable UI components
│   ├── pages/
│   │   ├── Welcome.tsx    # Landing page
│   │   ├── Login.tsx      # Login page
│   │   ├── Register.tsx   # Registration page
│   │   └── Index.tsx      # Main dashboard
│   └── hooks/             # Custom React hooks
├── backend/
│   ├── main.py           # FastAPI server
│   ├── requirements.txt  # Python dependencies
│   └── users.txt         # User data storage
└── package.json          # Node.js dependencies and scripts
```

## 🔧 Development

### Frontend Development
- Built with Vite for fast development
- TypeScript for type safety
- Tailwind CSS for styling
- React Router for navigation

### Backend Development
- FastAPI with automatic OpenAPI documentation
- Pydantic for data validation
- SHA-256 password hashing
- JSON file storage for simplicity

## 🚀 Deployment

### Frontend
```bash
npm run build
```

### Backend
The FastAPI server can be deployed using:
- Docker
- Railway
- Heroku
- Any Python hosting service

## 🔒 Security Notes

- Passwords are hashed using SHA-256
- CORS is configured for local development
- For production, implement proper JWT tokens and secure password hashing
- Use environment variables for sensitive configuration

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Happy coding! 🎉**
# LITTLEFOUNDERS-AI
