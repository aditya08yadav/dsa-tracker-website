# backend/Dockerfile
# Use a specific Python 3.12 image as the base
FROM python:3.12.2-slim-bullseye

# Set working directory inside the container
WORKDIR /app/backend

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Run the database creation script during the build
RUN python create_db.py

# Expose the port your Gunicorn server will listen on
EXPOSE 10000 # Render services typically listen on 10000

# Command to run the application using Gunicorn
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:10000"]