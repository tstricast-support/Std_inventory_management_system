from app.database import public_session
from app.models import User
from app.auth import hash_password, validate_new_password

db = public_session()
users = db.query(User).order_by(User.id).all()

print("\nUsers in this database:")
for u in users:
    print(f"  id={u.id}  username={u.username}  role={u.role.name}  active={u.is_active}")

username = input("\nType the username to reset: ").strip().lower()
user = db.query(User).filter(User.username == username).first()
if user is None:
    raise SystemExit("No such user.")

password = input("Type a NEW password (at least 10 characters): ")
problem = validate_new_password(password, username)
if problem:
    raise SystemExit(problem)

user.password_hash = hash_password(password)
user.must_change_password = False   # local testing only: no forced change at first login
user.failed_attempts = 0
user.locked_until = None
user.is_active = True
db.commit()
print(f"\nDone. You can now log in as '{username}'.")