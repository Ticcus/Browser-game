from flask import Flask, render_template, request, jsonify, session, redirect
import json
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

app = Flask(__name__)
app.secret_key = "your_secret_key_here"

def init_db():
    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                moderator BOOLEAN DEFAULT 0,
                admin BOOLEAN DEFAULT 0,
                ban BOOLEAN DEFAULT 0
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                score_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS highscores (
                user_id INTEGER PRIMARY KEY,
                highscore INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INTEGER PRIMARY KEY,
                volume INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
            )
        """)

        conn.commit()



def requires_login(f):
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect('/')
        if session.get('ban', False): 
            return redirect('/')  
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__ 
    return wrapper


@app.route('/')
def index():
    logged_in = session.get('logged_in', False)
    ban = session.get('ban', False)
    moderator = session.get('moderator', False)
    admin = session.get('admin', False) 
    return render_template('menu.html', logged_in=logged_in, admin=admin, moderator=moderator, ban= ban)

@app.route('/game_dificulty')
@requires_login
def game_dificulty():
    if session.get('ban', False):
        return redirect('/')
    with open('static/json/tower.json') as f:
        towers = json.load(f)
    return render_template('game_dificulty.html', towers=towers)


@app.route('/set_difficulty', methods=['POST'])
def set_difficulty():
    data = request.get_json()
    difficulty = data.get('difficulty')
    if difficulty not in ['Easy', 'Medium', 'Hard', 'Extreme']:
        return jsonify({'error': 'Invalid difficulty level'}), 400

    session['difficulty'] = difficulty
    return jsonify({'message': 'Difficulty set successfully'})

@app.route('/get_difficulty', methods=['GET'])
def get_difficulty():
    difficulty = session.get('difficulty', 'Easy') 
    return jsonify({'difficulty': difficulty})

@app.route('/game')
@requires_login
def game():
    if session.get('ban', False): 
        return redirect('/') 
    with open('static/json/tower.json') as f:
        towers = json.load(f)
    return render_template('game.html', towers=towers)


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT password, moderator, admin, ban FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()

    if not user:
        return jsonify({"message": "No user registered with this username."}), 404

    if not check_password_hash(user[0], password):
        return jsonify({"message": "Incorrect password. Please try again."}), 401

    session['logged_in'] = True
    session['username'] = username
    session['moderator'] = user[1]
    session['admin'] = user[2]
    session['ban'] = user[3]
    return jsonify({"message": "Login successful!", "moderator": user[1], "admin": user[2]})



@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if len(username) < 2:
        return jsonify({"message": "Username must be at least 2 characters long."}), 400

    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters long."}), 400

    hashed_password = generate_password_hash(password)
    try:
        with sqlite3.connect("users.db") as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (username, password, moderator, admin, ban) 
                VALUES (?, ?, 0, 0, 0)
            """, (username, hashed_password))
            conn.commit()
        return jsonify({"message": "Registration successful!"})
    except sqlite3.IntegrityError:
        return jsonify({"message": "Username already exists."}), 400

@app.route('/get_user_status', methods=['GET'])
def get_user_status():
    return jsonify({
        "logged_in": session.get('logged_in', False),
        "username": session.get('username', ''),
        "banned": session.get('ban', False),
        "admin": session.get('admin', False),
        "moderator": session.get('moderator', False)
    })

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    session.pop('moderator', None)
    session.pop('admin', None)
    session.pop('ban', None)
    return jsonify({"message": "Logged out successfully!"})

@app.route('/user_management', methods=['GET'])
@requires_login
def user_management():
    if not session.get('admin') and not session.get('moderator'):
        return redirect('/')
    
    if session.get('admin'):
        return render_template('user_management_admin.html')
    else:
        return render_template('user_management_moderator.html')


@app.route('/search_users', methods=['GET'])
@requires_login
def search_users():
    if not session.get('admin') and not session.get('moderator'):
        return jsonify({"message": "Unauthorized"}), 403

    query = request.args.get('query', '')
    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, username, moderator, admin, ban FROM users WHERE username LIKE ?", ('%' + query + '%',))
        users = cursor.fetchall()

    return jsonify(users)

@app.route('/update_user', methods=['POST'])
@requires_login
def update_user():
    if not session.get('moderator') and not session.get('admin'):
        return jsonify({"message": "Unauthorized"}), 403

    data = request.get_json()
    user_id = data.get('user_id')
    ban = data.get('ban')
    moderator = data.get('moderator', None)
    admin = data.get('admin', None)

    if session.get('moderator') and ('moderator' in data or 'admin' in data):
        return jsonify({"message": "Moderators cannot modify roles."}), 403

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT ban, moderator FROM users WHERE user_id = ?", (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "User not found"}), 404

        current_ban, current_moderator = user

        if ban is not None and ban != current_ban:
            cursor.execute("UPDATE users SET ban = ? WHERE user_id = ?", (ban, user_id))

        if session.get('admin') and moderator is not None and moderator != current_moderator:
            cursor.execute("UPDATE users SET moderator = ? WHERE user_id = ?", (moderator, user_id))

        if session.get('admin') and admin is not None:
            cursor.execute("UPDATE users SET admin = ? WHERE user_id = ?", (admin, user_id))

        conn.commit()

    return jsonify({"message": "User updated successfully!"})

@app.route('/delete_user', methods=['POST'])
@requires_login
def delete_user():
    if not session.get('admin'):
        return jsonify({"message": "Unauthorized"}), 403

    data = request.get_json()
    user_id = data.get('user_id')

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        conn.commit()

    return jsonify({"message": "User deleted successfully!"})

@app.route('/delete_highscore', methods=['POST'])
@requires_login
def delete_highscore():
    if not session.get('moderator') and not session.get('admin'):
        return jsonify({"success": False, "message": "Unauthorized access"}), 403

    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({"success": False, "message": "Invalid username provided"}), 400

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT user_id FROM users WHERE username = ?", (username,))
        user_id = cursor.fetchone()

        if not user_id:
            return jsonify({"success": False, "message": "User not found"}), 404

        cursor.execute("DELETE FROM highscores WHERE user_id = ?", (user_id[0],))
        conn.commit()

    return jsonify({"success": True, "message": f"Highscore for {username} deleted successfully!"})

@app.route('/save_score', methods=['POST'])
def save_score():
    if not session.get('logged_in'):
        return jsonify({"message": "User not logged in"}), 403

    data = request.get_json()
    score = data.get('score')

    if score is None or not isinstance(score, int):
        return jsonify({"message": "Invalid score data"}), 400

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        username = session.get('username')

        cursor.execute("""
            SELECT user_id FROM users WHERE username = ?
        """, (username,))
        user_id = cursor.fetchone()
        if not user_id:
            return jsonify({"message": "User not found"}), 404

        cursor.execute("""
            INSERT INTO scores (user_id, score) VALUES (?, ?)
        """, (user_id[0], score))

        cursor.execute("""
            SELECT highscore FROM highscores WHERE user_id = ?
        """, (user_id[0],))
        highscore_row = cursor.fetchone()

        if highscore_row:
            current_highscore = highscore_row[0]
            if score > current_highscore:
                cursor.execute("""
                    UPDATE highscores SET highscore = ? WHERE user_id = ?
                """, (score, user_id[0]))
        else:
            cursor.execute("""
                INSERT INTO highscores (user_id, highscore) VALUES (?, ?)
            """, (user_id[0], score))

        cursor.execute("""
            DELETE FROM scores
            WHERE score_id NOT IN (
                SELECT score_id FROM scores WHERE user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            )
        """, (user_id[0],))

        conn.commit()

    return jsonify({"message": "Score saved successfully!"})


@app.route('/get_scores', methods=['GET'])
def get_scores():
    if not session.get('logged_in'):
        return jsonify({"message": "User not logged in"}), 403

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        username = session.get('username')

        cursor.execute("""
            SELECT highscore FROM highscores WHERE username = ?
        """, (username,))
        high_score = cursor.fetchone()
        high_score = high_score[0] if high_score else 0

        cursor.execute("""
            SELECT score, timestamp FROM scores WHERE username = ?
            ORDER BY timestamp DESC LIMIT 10
        """, (username,))
        recent_scores = cursor.fetchall()

    return jsonify({
        "high_score": high_score,
        "recent_scores": [{"score": score, "timestamp": timestamp} for score, timestamp in recent_scores]
    })

@app.route('/highscores')
def highscores():
    if session.get('moderator') or session.get('admin'):
        return redirect('/highscores_management')
    
    search_query = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    per_page = 50
    offset = (page - 1) * per_page

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.username, h.highscore 
            FROM highscores h
            JOIN users u ON h.user_id = u.user_id
            ORDER BY h.highscore DESC
        """)
        all_highscores = cursor.fetchall()

        rank_map = {username: rank + 1 for rank, (username, _) in enumerate(all_highscores)}

        if search_query:
            cursor.execute("""
                SELECT u.username, h.highscore 
                FROM highscores h
                JOIN users u ON h.user_id = u.user_id
                WHERE u.username LIKE ?
                ORDER BY h.highscore DESC
                LIMIT ? OFFSET ?
            """, (f'%{search_query}%', per_page, offset))
        else:
            cursor.execute("""
                SELECT u.username, h.highscore 
                FROM highscores h
                JOIN users u ON h.user_id = u.user_id
                ORDER BY h.highscore DESC
                LIMIT ? OFFSET ?
            """, (per_page, offset))
        
        filtered_highscores = cursor.fetchall()

        cursor.execute("""
            SELECT COUNT(*)
            FROM highscores h
            JOIN users u ON h.user_id = u.user_id
            WHERE u.username LIKE ?
        """, (f'%{search_query}%',))
        total_entries = cursor.fetchone()[0]

    highscores_with_rank = [
        (rank_map[username], username, highscore)
        for username, highscore in filtered_highscores
    ]

    total_pages = (total_entries + per_page - 1) // per_page
    start_page = max(1, page - 2)
    end_page = min(total_pages, page + 2)

    return render_template(
        'highscores.html',
        highscores=highscores_with_rank,
        page=page,
        total_pages=total_pages,
        start_page=start_page,
        end_page=end_page,
        search_query=search_query
    )


@app.route('/highscores_management')
@requires_login
def highscores_management():
    if not session.get('moderator') and not session.get('admin'):
        return redirect('/') 
    search_query = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    per_page = 50
    offset = (page - 1) * per_page

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.username, h.highscore 
            FROM highscores h
            JOIN users u ON h.user_id = u.user_id
            ORDER BY h.highscore DESC
        """)
        all_highscores = cursor.fetchall()

        rank_map = {username: rank + 1 for rank, (username, _) in enumerate(all_highscores)}

        if search_query:
            cursor.execute("""
                SELECT u.username, h.highscore 
                FROM highscores h
                JOIN users u ON h.user_id = u.user_id
                WHERE u.username LIKE ?
                ORDER BY h.highscore DESC
                LIMIT ? OFFSET ?
            """, (f'%{search_query}%', per_page, offset))
        else:
            cursor.execute("""
                SELECT u.username, h.highscore 
                FROM highscores h
                JOIN users u ON h.user_id = u.user_id
                ORDER BY h.highscore DESC
                LIMIT ? OFFSET ?
            """, (per_page, offset))
        
        filtered_highscores = cursor.fetchall()

        cursor.execute("""
            SELECT COUNT(*)
            FROM highscores h
            JOIN users u ON h.user_id = u.user_id
            WHERE u.username LIKE ?
        """, (f'%{search_query}%',))
        total_entries = cursor.fetchone()[0]

    highscores_with_rank = [
        (rank_map[username], username, highscore)
        for username, highscore in filtered_highscores
    ]

    total_pages = (total_entries + per_page - 1) // per_page
    start_page = max(1, page - 2)
    end_page = min(total_pages, page + 2)

    return render_template(
        'highscores_moderator_view.html',
        highscores=highscores_with_rank,
        page=page,
        total_pages=total_pages,
        start_page=start_page,
        end_page=end_page,
        search_query=search_query
    )


@app.route('/save_preferences', methods=['POST'])
@requires_login
def save_preferences():
    data = request.get_json()
    volume = data.get('volume')

    if volume is None or not isinstance(volume, int):
        return jsonify({"message": "Invalid volume data"}), 400

    username = session.get('username')

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id FROM users WHERE username = ?
        """, (username,))
        user_id = cursor.fetchone()
        if not user_id:
            return jsonify({"message": "User not found"}), 404

        cursor.execute("""
            INSERT INTO user_preferences (user_id, volume)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET volume = ?
        """, (user_id[0], volume, volume))

        conn.commit()

    return jsonify({"message": "Preferences saved successfully!"})


@app.route('/get_preferences', methods=['GET'])
@requires_login
def get_preferences():
    username = session.get('username')

    with sqlite3.connect("users.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id FROM users WHERE username = ?
        """, (username,))
        user_id = cursor.fetchone()
        if not user_id:
            return jsonify({"message": "User not found"}), 404

        cursor.execute("""
            SELECT volume FROM user_preferences WHERE user_id = ?
        """, (user_id[0],))
        row = cursor.fetchone()

    volume = row[0] if row else 50 
    return jsonify({"volume": volume})



if __name__ == '__main__':
    init_db()
    app.run(debug=True)
