from app import create_app

app = create_app()

if __name__ == "__main__":
    # Port 5000 is taken by AirPlay Receiver on macOS, so use 5001.
    app.run(host="127.0.0.1", port=5001, debug=True)
