import os
import sys
import subprocess

def get_dynamic_ip():
    try:
        result = subprocess.run(["node", "scripts/get_ip.js"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except Exception:
        return "127.0.0.1"

local_ip = get_dynamic_ip()
mobile_web_url = os.environ.get("MOBILE_WEB_URL", sys.argv[1] if len(sys.argv) > 1 else f"http://{local_ip}:3000/mobile")
expo_url = os.environ.get("EXPO_URL", sys.argv[2] if len(sys.argv) > 2 else f"exp://{local_ip}:8081")

output_dirs = [os.path.join(os.path.dirname(__file__))]

try:
    import qrcode

    for out_dir in output_dirs:
        os.makedirs(out_dir, exist_ok=True)

        # 1. Expo Go QR Code
        img_expo = qrcode.make(expo_url)
        expo_path = os.path.join(out_dir, "expo_go_qr.png")
        img_expo.save(expo_path)
        print(f"Saved Expo Go QR: {expo_path}")

        # 2. Mobile Web QR Code
        img_web = qrcode.make(mobile_web_url)
        web_path = os.path.join(out_dir, "mobile_web_qr.png")
        img_web.save(web_path)
        print(f"Saved Mobile Web QR: {web_path}")

except Exception as e:
    print(f"Error generating QR images: {e}")

