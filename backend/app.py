import os # Add this line
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import json
import uuid
# app.py (inside your backend folder)

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
import uuid

# Initialize Flask app
app = Flask(__name__)
# Enable CORS for communication with frontend (IMPORTANT!)
CORS(app, resources={r"/*": {"origins": "http://127.0.0.1:5500"}})


# --- Database Configuration ---
# Use DATABASE_URL environment variable for cloud deployment, fallback to SQLite for local
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///site.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ... (rest of your app.py) ...
# Initialize SQLAlchemy
db = SQLAlchemy(app)

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    problems = db.relationship('Problem', backref='author', lazy=True)
    notes = db.relationship('Note', backref='author', lazy=True)

    def __repr__(self):
        return '<User %r>' % self.username
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username
        }

class Problem(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(200), nullable=False)
    link = db.Column(db.String(500), nullable=True)
    topic = db.Column(db.String(100), nullable=False)
    difficulty = db.Column(db.String(50), nullable=False)
    time_complexity = db.Column(db.String(100), nullable=True)
    space_complexity = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    solved = db.Column(db.Boolean, default=False)
    important = db.Column(db.Boolean, default=False)
    solution_code = db.Column(db.Text, nullable=True)
    added_date = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False) # Remains False by default in DB for now, updated by code

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'link': self.link, 'topic': self.topic,
            'difficulty': self.difficulty, 'timeComplexity': self.time_complexity,
            'spaceComplexity': self.space_complexity, 'notes': self.notes,
            'solved': self.solved, 'important': self.important,
            'solutionCode': self.solution_code, 'addedDate': self.added_date,
            'userId': self.user_id, 'isPublic': self.is_public
        }

class Note(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False)
    topic = db.Column(db.String(100), nullable=False)
    link = db.Column(db.String(500), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    added_date = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'topic': self.topic,
            'link': self.link, 'remarks': self.remarks, 'addedDate': self.added_date,
            'userId': self.user_id
        }

# --- API Endpoints for PROBLEMS ---

@app.route('/problems', methods=['GET'])
def get_problems():
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401
    
    problems = Problem.query.filter_by(user_id=user_id).all()
    return jsonify([p.to_dict() for p in problems])

@app.route('/problems', methods=['POST'])
def add_or_sync_problems():
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    received_data = request.json
    if not received_data:
        return jsonify({"message": "No data provided"}), 400

    if isinstance(received_data, list):
        try:
            # Delete only problems belonging to the current user
            Problem.query.filter_by(user_id=user_id).delete()
            db.session.commit()
            for item_data in received_data:
                # Ensure the data coming from frontend belongs to this user_id
                if item_data.get('userId') != user_id:
                    continue # Skip items that don't belong to the current user (shouldn't happen with correct frontend logic)

                new_item = Problem(
                    id=item_data.get('id', str(uuid.uuid4())), # Use existing ID or generate new
                    name=item_data.get('name'),
                    link=item_data.get('link'),
                    topic=item_data.get('topic'),
                    difficulty=item_data.get('difficulty'),
                    time_complexity=item_data.get('timeComplexity'),
                    space_complexity=item_data.get('spaceComplexity'),
                    notes=item_data.get('notes'),
                    solved=item_data.get('solved'),
                    important=item_data.get('important'),
                    solution_code=item_data.get('solutionCode'),
                    added_date=item_data.get('addedDate'),
                    user_id=user_id, # Always use user_id from header for security
                    is_public=item_data.get('isPublic', False) # Keep this as received, but frontend hardcodes to true now
                )
                db.session.add(new_item)
            db.session.commit()
            return jsonify({"message": "Problems list synced successfully"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": f"Error syncing problems: {str(e)}"}), 500
    else: # Adding a single new problem or updating an existing one
        existing_problem = Problem.query.get(received_data.get('id'))

        if existing_problem and existing_problem.user_id == user_id: # Ensure user owns the problem
            # Update existing problem
            existing_problem.name = received_data.get('name', existing_problem.name)
            existing_problem.link = received_data.get('link', existing_problem.link)
            existing_problem.topic = received_data.get('topic', existing_problem.topic)
            existing_problem.difficulty = received_data.get('difficulty', existing_problem.difficulty)
            existing_problem.time_complexity = received_data.get('timeComplexity', existing_problem.time_complexity)
            existing_problem.space_complexity = received_data.get('spaceComplexity', existing_problem.space_complexity)
            existing_problem.notes = received_data.get('notes', existing_problem.notes)
            existing_problem.solved = received_data.get('solved', existing_problem.solved)
            existing_problem.important = received_data.get('important', existing_problem.important)
            existing_problem.solution_code = received_data.get('solutionCode', existing_problem.solution_code)
            existing_problem.is_public = received_data.get('isPublic', existing_problem.is_public) # Update this from received data
            db.session.commit()
            return jsonify({"message": "Problem updated successfully", "problem": existing_problem.to_dict()}), 200
        else:
            # Add new problem
            new_problem = Problem(
                id=received_data.get('id', str(uuid.uuid4())), # Allow frontend to send ID for new if it has one
                name=received_data.get('name'),
                link=received_data.get('link'),
                topic=received_data.get('topic'),
                difficulty=received_data.get('difficulty'),
                time_complexity=received_data.get('timeComplexity'),
                space_complexity=received_data.get('spaceComplexity'),
                notes=received_data.get('notes'),
                solved=received_data.get('solved', False),
                important=received_data.get('important', False),
                solution_code=received_data.get('solutionCode'),
                added_date=received_data.get('addedDate'),
                user_id=user_id, # Always use user_id from header for security
                is_public=received_data.get('isPublic', False) # Default to false if not provided, but frontend hardcodes true
            )
            db.session.add(new_problem)
            db.session.commit()
            return jsonify({"message": "Problem added successfully", "problem": new_problem.to_dict()}), 201

@app.route('/problems/<id>', methods=['DELETE'])
def delete_problem(id):
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    problem_to_delete = Problem.query.filter_by(id=id, user_id=user_id).first()
    if problem_to_delete:
        db.session.delete(problem_to_delete)
        db.session.commit()
        return jsonify({"message": f"Problem with ID {id} deleted successfully"}), 200
    return jsonify({"message": "Problem not found or unauthorized"}), 404


# --- API Endpoints for NOTES ---

@app.route('/notes', methods=['GET'])
def get_notes():
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    notes = Note.query.filter_by(user_id=user_id).all()
    return jsonify([n.to_dict() for n in notes])

@app.route('/notes', methods=['POST'])
def add_or_sync_notes():
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    received_data = request.json
    if not received_data:
        return jsonify({"message": "No data provided"}), 400

    if isinstance(received_data, list):
        try:
            Note.query.filter_by(user_id=user_id).delete()
            db.session.commit()
            for item_data in received_data:
                if item_data.get('userId') != user_id:
                    continue 
                new_item = Note(
                    id=item_data.get('id', str(uuid.uuid4())),
                    title=item_data.get('title'),
                    topic=item_data.get('topic'),
                    link=item_data.get('link'),
                    remarks=item_data.get('remarks'),
                    added_date=item_data.get('addedDate'),
                    user_id=user_id
                )
                db.session.add(new_item)
            db.session.commit()
            return jsonify({"message": "Notes list synced successfully"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": f"Error syncing notes: {str(e)}"}), 500
    else:
        existing_note = Note.query.get(received_data.get('id'))
        
        if existing_note and existing_note.user_id == user_id: # Ensure user owns the note
            existing_note.title = received_data.get('title', existing_note.title)
            existing_note.topic = received_data.get('topic', existing_note.topic)
            existing_note.link = received_data.get('link', existing_note.link)
            existing_note.remarks = received_data.get('remarks', existing_note.remarks)
            db.session.commit()
            return jsonify({"message": "Note updated successfully", "note": existing_note.to_dict()}), 200
        else:
            new_note = Note(
                id=received_data.get('id', str(uuid.uuid4())), # Allow frontend to send ID for new if it has one
                title=received_data.get('title'),
                topic=received_data.get('topic'),
                link=received_data.get('link'),
                remarks=received_data.get('remarks'),
                added_date=received_data.get('addedDate'),
                user_id=user_id
            )
            db.session.add(new_note)
            db.session.commit()
            return jsonify({"message": "Note added successfully", "note": new_note.to_dict()}), 201

@app.route('/notes/<id>', methods=['DELETE'])
def delete_note(id):
    user_id = request.headers.get('User-Id')
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    note_to_delete = Note.query.filter_by(id=id, user_id=user_id).first()
    if note_to_delete:
        db.session.delete(note_to_delete)
        db.session.commit()
        return jsonify({"message": f"Note with ID {id} deleted successfully"}), 200
    return jsonify({"message": "Note not found or unauthorized"}), 404


# API Endpoints for USER Registration and Login
@app.route('/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 409 # Conflict

    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully", "user": new_user.to_dict()}), 201

@app.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        return jsonify({"message": "Login successful", "userId": user.id, "username": user.username}), 200
    return jsonify({"message": "Invalid username or password"}), 401 # Unauthorized

# Public Problems API Endpoint
@app.route('/public_problems', methods=['GET'])
def get_public_problems():
    # This endpoint now fetches ALL problems because the 'is_public' flag is always True on add
    # If you still want to filter by 'is_public' in the future, change this back
    # For now, it will fetch all if you made them public using the migration endpoint.
    public_problems = Problem.query.all() # Changed from .filter_by(is_public=True)
    # Also fetch the username for each problem's author
    result = []
    for problem in public_problems:
        problem_dict = problem.to_dict()
        author = User.query.get(problem.user_id)
        problem_dict['username'] = author.username if author else 'Unknown User'
        result.append(problem_dict)
    return jsonify(result)

# # Temporary Endpoint to make all existing problems public
# # RUN THIS ONCE AFTER RESTARTING app.py, THEN YOU CAN REMOVE IT.
# @app.route('/make_all_problems_public', methods=['POST'])
# def make_all_problems_public():
#     try:
#         problems = Problem.query.all()
#         for problem in problems:
#             problem.is_public = True
#         db.session.commit()
#         return jsonify({"message": "All existing problems set to public"}), 200
#     except Exception as e:
#         db.session.rollback()
#         return jsonify({"message": f"Error making problems public: {str(e)}"}), 500


# --- Running the Flask App ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    app.run(debug=True, port=5001)