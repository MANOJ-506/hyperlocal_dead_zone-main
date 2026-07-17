To Run the project:

1) Backend:
cd backend
venv\Scripts\activate
(venv) pip install -r requirements.txt
(venv) uvicorn app:app --reload
-sqldatabase:http://127.0.0.1:8000/docs#/

2) Frontend:
cd frontend
npm install
npm run dev