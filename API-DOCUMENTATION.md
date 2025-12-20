# TestRiser API Documentation

## 🚀 Quick Start

### Base URL
- **Local Development:** `http://localhost:5001`
- **API Documentation:** `http://localhost:5001/api-docs`

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📦 Postman Collection

### Importing the Collection

1. **Open Postman**
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `TestRiser-API-Collection.postman_collection.json`
5. Click **Import**

### Setting Up Variables

The collection uses these variables:
- `base_url` - Default: `http://localhost:5001`
- `jwt_token` - Auto-populated after login
- `admin_email` - Default: `admin@testriser.com`
- `admin_password` - Default: `admin123`

To update variables:
1. Right-click the collection → **Edit**
2. Go to **Variables** tab
3. Update the values as needed

### Auto-Authentication

The **Sign In** request automatically saves the JWT token to `{{jwt_token}}` variable. After signing in, all authenticated requests will automatically use this token.

---

## 🔐 Authentication Flow

### 1. Register New User (Student)
```http
POST /api/auth/sign-up
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+91 9876543210"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "name": "John Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Login
```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "admin@testriser.com",
  "password": "admin123"
}
```

### 3. Get Current Session
```http
GET /api/auth/session
Authorization: Bearer {{jwt_token}}
```

---

## 📚 Common Workflows

### Workflow 1: Upload and Process a Book

1. **Login as Admin**
```http
POST /api/auth/sign-in
{
  "email": "admin@testriser.com",
  "password": "admin123"
}
```

2. **Upload PDF Book**
```http
POST /api/admin/books/upload
Content-Type: multipart/form-data

file: [PDF File]
title: "NEET Physics 2024 PYQ"
subject: "physics"
bookType: "pyq"
pyqType: "subject_wise"
```

3. **Monitor Progress (SSE)**
```http
GET /api/admin/books/{bookId}/progress/stream?token={{jwt_token}}
```

4. **Get Extraction Report**
```http
GET /api/admin/books/{bookId}/extraction-report
```

5. **View Extracted Questions**
```http
GET /api/admin/books/{bookId}/questions
```

---

### Workflow 2: Create and Publish a Mock Test

1. **Auto-Generate Mock Test**
```http
POST /api/admin/mock-tests/generate
{
  "title": "NEET Full Length Mock Test 1",
  "testType": "full_test",
  "totalQuestions": 180,
  "duration": 180,
  "distribution": {
    "physics": 45,
    "chemistry": 45,
    "biology": 90
  }
}
```

2. **Review Generated Questions**
```http
GET /api/admin/mock-tests/{mockTestId}
```

3. **Publish Mock Test**
```http
POST /api/admin/mock-tests/{mockTestId}/publish
```

---

### Workflow 3: Student Takes an Exam

1. **Get Available Papers**
```http
GET /api/exam/papers
```

2. **Start Exam**
```http
POST /api/student/exams/start
{
  "paperId": "paper-uuid",
  "mockTestId": null
}
```

3. **Submit Answers**
```http
POST /api/student/exams/{examId}/answer
{
  "questionId": "question-uuid",
  "selectedAnswer": "A",
  "isMarkedForReview": false,
  "timeSpent": 45
}
```

4. **Submit Exam**
```http
POST /api/student/exams/{examId}/submit
```

5. **Get Results**
```http
GET /api/student/exams/{examId}/result
```

---

## 📊 Query Parameters

### Books Filtering
```
GET /api/admin/books?status=pending&subject=physics&page=1&limit=10
```
**Parameters:**
- `status` - Filter by upload status (pending, processing, completed, failed)
- `subject` - Filter by subject (physics, chemistry, biology)
- `page` - Page number for pagination
- `limit` - Items per page

### Questions Filtering
```
GET /api/admin/questions?subject=physics&topic=mechanics&difficulty=medium
```
**Parameters:**
- `subject` - Filter by subject
- `topic` - Filter by topic
- `subtopic` - Filter by subtopic
- `difficulty` - Filter by difficulty (easy, medium, hard)
- `questionType` - Filter by type
- `page` - Page number
- `limit` - Items per page

---

## 🎯 Role-Based Access

### Public Endpoints (No Auth)
- Health check
- Sign up / Sign in
- Get published papers
- Get published mock tests
- Submit contact form
- Get active subjects

### Student Endpoints
- All practice endpoints
- Start/submit exams
- View exam results
- Get exam history

### Admin Endpoints
- All books management
- All papers management
- All questions management
- All mock tests management
- Student management
- Contact messages
- Curriculum chapters
- Subjects management

---

## 📝 Request Body Examples

### Create Question
```json
{
  "subject": "physics",
  "topic": "Mechanics",
  "subtopic": "Laws of Motion",
  "questionText": "A body of mass 5 kg is moving with velocity 10 m/s. Find momentum.",
  "questionType": "single_correct",
  "optionA": "50 kg m/s",
  "optionB": "5 kg m/s",
  "optionC": "10 kg m/s",
  "optionD": "0.5 kg m/s",
  "correctAnswer": "A",
  "explanation": "Momentum = mass × velocity = 5 × 10 = 50 kg m/s",
  "difficulty": "easy",
  "questionNumber": 1,
  "marksPositive": 4.00,
  "marksNegative": 1.00
}
```

### Create Paper
```json
{
  "title": "NEET 2024 Mock Test",
  "description": "Full length NEET mock test",
  "year": 2024,
  "duration": 180,
  "totalMarks": 720,
  "totalQuestions": 180
}
```

### Create Mock Test
```json
{
  "title": "Subject-wise Physics Mock",
  "description": "Physics only mock test",
  "testType": "subject_wise",
  "subject": "physics",
  "duration": 60,
  "totalMarks": 180,
  "totalQuestions": 45
}
```

---

## 🔄 Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## 🎓 Testing Tips

### 1. Use Environment Variables
Create different environments in Postman:
- **Local** - `http://localhost:5001`
- **Staging** - Your staging URL
- **Production** - Your production URL

### 2. Use Pre-request Scripts
Auto-login before running a collection:
```javascript
pm.sendRequest({
    url: pm.variables.get("base_url") + "/api/auth/sign-in",
    method: 'POST',
    header: {'Content-Type': 'application/json'},
    body: {
        mode: 'raw',
        raw: JSON.stringify({
            email: pm.variables.get("admin_email"),
            password: pm.variables.get("admin_password")
        })
    }
}, function (err, res) {
    pm.variables.set("jwt_token", res.json().token);
});
```

### 3. Use Tests
Add automatic validation:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});
```

---

## 📖 Additional Resources

- **Swagger UI:** http://localhost:5001/api-docs
- **Swagger JSON:** http://localhost:5001/api-docs.json
- **Health Check:** http://localhost:5001/health

---

## 🐛 Troubleshooting

### Authentication Issues
- Ensure token is saved after login
- Check token expiry (default: 7 days)
- Verify Authorization header format: `Bearer <token>`

### CORS Issues
- Add your frontend URL to `CORS_ORIGIN` in `.env`
- Default allowed origins: `http://localhost:3000`, `http://localhost:5000`

### Upload Issues
- Check file size limits
- Ensure correct Content-Type (multipart/form-data)
- Verify admin authentication

### Database Connection
- Run migrations: `npm run db:push`
- Check DATABASE_URL in `.env`
- Verify Supabase credentials

---

## 📞 Support

For issues or questions:
1. Check Swagger documentation
2. Review error messages in response
3. Check server logs for detailed errors
4. Contact support team

---

**Last Updated:** 2025-12-16
**API Version:** 1.0.7
