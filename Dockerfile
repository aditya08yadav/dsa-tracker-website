# Dockerfile (now in root)
# Use a specific Python 3.12 image as the base
FROM python:3.12.2-slim-bullseye

# Set working directory inside the container to the /app (root of container)
WORKDIR /app # CHANGED FROM /app/backend

# Copy backend requirements.txt and install Python dependencies
# We copy backend/requirements.txt because it's in a subfolder
COPY backend/requirements.txt backend/requirements.txt # Copy to a subfolder within container
RUN pip install --no-cache-dir backend/requirements.txt # Install from there

# Copy the entire backend folder
COPY backend/ backend/ # Copy backend folder to /app/backend in container

# Run the database creation script during the build
RUN python backend/create_db.py # Path now relative to /app (container root)

# Expose the port your Gunicorn server will listen on
EXPOSE 10000

# Command to run the application using Gunicorn
# app.py is now at backend/app.py relative to WORKDIR /app
CMD ["gunicorn", "backend.app:app", "--bind", "0.0.0.0:10000"] # CHANGED: backend.app:app