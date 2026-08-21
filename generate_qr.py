
import qrcode

# Το URL της εφαρμογής σου
url = "https://gortynia-demo.vercel.app"

# Δημιουργία QR code
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill='black', back_color='white')
img.save("gortynia_qr.png")



from rembg import remove
from PIL import Image

input_image = Image.open("mark2.png")
output_image = remove(input_image)
output_image.save("output.png")