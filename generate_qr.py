import qrcode

# Το URL της εφαρμογής σου
url = "https://gortynia-demo.vercel.app"

# Δημιουργία QR code
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill='black', back_color='white')
img.save("gortynia_qr.png")