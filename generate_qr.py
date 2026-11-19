"""QR codes για την εφαρμογή.

Χρήση:
    python generate_qr.py            # QR για το δημοσιευμένο site (πάντα η τελευταία έκδοση που ανέβηκε)
    python generate_qr.py --local    # QR για τον υπολογιστή σας (npm start), για δοκιμές από κινητό στο ίδιο Wi-Fi

Χρειάζεται:  pip install qrcode pillow
"""
import socket
import sys

import qrcode
from PIL import Image, ImageDraw, ImageFont

SITE_URL = "https://gortynia-demo.vercel.app"
ICON = "public/icon-192.png"


def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # δεν στέλνει τίποτα· απλώς βρίσκει την IP του δικτύου
        return s.getsockname()[0]
    finally:
        s.close()


def font(size, bold=False):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def make(url, title, subtitle, out_path, dark="#1c1917", accent="#b45309"):
    # Υψηλή διόρθωση λαθών (H) ώστε να διαβάζεται και με το εικονίδιο στη μέση
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=16, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    code = qr.make_image(fill_color=dark, back_color="white").convert("RGB")

    # Εικονίδιο στο κέντρο
    try:
        icon = Image.open(ICON).convert("RGBA")
        side = code.width // 5
        icon = icon.resize((side, side), Image.LANCZOS)
        pad = side // 8
        box = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), "white")
        mask = Image.new("L", box.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, *box.size], radius=pad * 2, fill=255)
        pos = ((code.width - box.width) // 2, (code.height - box.height) // 2)
        code.paste(box, pos, mask)
        code.paste(icon, (pos[0] + pad, pos[1] + pad), icon)
    except FileNotFoundError:
        pass

    # Κάρτα με τίτλο και διεύθυνση από κάτω
    W = code.width + 80
    H = code.height + 230
    card = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(card)
    d.rectangle([0, 0, W, 14], fill=accent)
    card.paste(code, (40, 50))
    d.text((W // 2, code.height + 80), title, font=font(46, True), fill=dark, anchor="mm")
    d.text((W // 2, code.height + 135), subtitle, font=font(28), fill="#57534e", anchor="mm")
    d.text((W // 2, code.height + 185), url.replace("https://", ""), font=font(26, True), fill=accent, anchor="mm")
    card.save(out_path)
    print(f"{out_path}  ->  {url}")


if __name__ == "__main__":
    if "--local" in sys.argv:
        make(f"http://{local_ip()}:3000", "Πάμε Πανηγύρι · δοκιμή", "Μόνο στο ίδιο Wi-Fi, με ανοιχτό το npm start",
             "qr_local.png", accent="#0369a1")
    else:
        make(SITE_URL, "Πάμε Πανηγύρι", "Σκανάρετε με την κάμερα του κινητού", "gortynia_qr.png")
        make(SITE_URL, "Πάμε Πανηγύρι", "Σκανάρετε με την κάμερα του κινητού", "public/qr.png")
