# Operations Dashboard Backend

A FastAPI backend for the Operations Dashboard that handles user authentication and stores user data in a text file.

## Features

- User registration with validation
- User login with password hashing
- User data storage in text file (`users.txt`)
- CORS enabled for frontend integration
- Demo user account pre-created

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the FastAPI server:
```bash
python main.py
```

The server will start on `http://localhost:8000`

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
  - Body: `{"name": "string", "email": "string", "password": "string"}`
  
- `POST /auth/login` - Login with email and password
  - Body: `{"email": "string", "password": "string"}`

- `GET /auth/users` - Get all users (development only)

### Demo Account

A demo account is automatically created:
- Email: `admin@example.com`
- Password: `password123`

## Data Storage

User data is stored in `users.txt` file in JSON format, one user per line.

## Security Notes

- Passwords are hashed using SHA-256
- CORS is configured for local development
- In production, use proper authentication tokens and secure password hashing