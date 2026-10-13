"""
Generate 800 synthetic Amharic medical document images.
- Continuous Amharic sentences (not word lists)
- Noto Serif Ethiopic font
- 5-9 lines per image
- Pure Amharic medical content
"""

import csv, random, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_PATH = r"C:\Users\Dagamwi\Downloads\Noto_Serif_Ethiopic\static\NotoSerifEthiopic-Regular.ttf"
OUT_DIR   = Path("D:/medxplain/ocr_training_data")
IMG_DIR   = OUT_DIR / "images"
LABEL_CSV = OUT_DIR / "labels.csv"
IMG_DIR.mkdir(parents=True, exist_ok=True)

# ── Full Amharic medical sentences ────────────────────────────────────────────
SENTENCES = [
    # Symptoms
    "ህሙሙ ከትናንት ጀምሮ ከፍተኛ ትኩሳት አለባቸው።",
    "ባለፉት ሁለት ቀናት ከፍተኛ ራስ ምታት ሲሰቃዩ ቆይተዋል።",
    "ሆዳቸው እየቃዘናቸው ምግብ ለማዋጥ ይቸግራቸዋል።",
    "ሌሊት ልብ ሲደሰቃቸው ከእንቅልፋቸው ይነሳሉ።",
    "ቆዳቸው ቢጫ ሆኖ ዓይናቸው ቢጫ ቀለም ይታያል።",
    "ትንፋሽ ሲወስዱ ህመም ይሰማቸዋል።",
    "የሰውነታቸው ክብደት ባለፉት ወራት ቀንሷል።",
    "አካሏ ላይ ቀይ ሽፍታ ወጥቶ ማሳከክ አለ።",
    "ጀርባቸው ሲያምማቸው ቆሞ መቆየት ያቸግራቸዋል።",
    "ምሽቱ ላይ ብዙ ላብ እያቀናቸው ያሰናብቷቸዋል።",
    "ሽንት ሲሸኑ ህመምና ቃጠሎ ይሰማቸዋል።",
    "አፋቸው ደርቆ ብዙ ውሃ ቢጠጡም አይቆምም።",
    "ማቅለሽለሽ ስሜት ኖሮ ሁለት ጊዜ ተፉ።",
    "ዓይናቸው ቀይ ሆኖ ብርሃን ሲያዩ ይቃጠሉ።",
    "ሁለቱም እግሮቻቸው አብጠው ጫማ ማድረግ ተቸግረዋል።",
    "ምቾት አጥተው ሌሊት ሙሉ አልተኙም።",
    "ሆዳቸው ነፍቶ ምቾት አይሰማቸውም።",
    "ጆሮቻቸው ሲሽቆጥቆጥ ድምጽ ይሰሙ።",
    "አይናቸው ፊት ጭጋግ ያያሉ።",
    "ቡጢ ቡጢ ሲያሳሳቸው ሙሉ ሰውነታቸው ያሳምማቸዋል።",

    # Diagnoses
    "የምርምር ውጤቱ የወባ ትኩሳት መኖሩን አረጋገጠ።",
    "ህሙሙ የስኳር ህሙምነት ደረጃ ሁለት ታይቶባቸዋል።",
    "ደም ግፊታቸው ፻፵ ሜ.ሜ ሃ.ሃ ደርሷል።",
    "ሳምባ ምች ህሙምነት ተረጋግጦ ህክምና ተጀምሯል።",
    "የጨጓራ ቁስለት ምርመራ አረጋግጧል።",
    "የኩላሊት ህሙምነት ምልክቶች ታይተዋል።",
    "ቲፎይድ ትኩሳት ተረጋግጦ ፀረ ባክቴሪያ ተሰጥቷቸዋል።",
    "አናሚያ ምልክቶች ከፍ ያሉ ሲሆን ህክምና ያስፈልጋቸዋል።",
    "የልብ ምት ቅደም ተከተል ተዛብቷል።",
    "ነፍሰ ጡር ሲሆኑ ደም ግፊት ስለጨመረ ይከታተላሉ።",

    # Vitals
    "ዛሬ ጠዋት የደም ግፊት ፻፵ ሜ.ሜ ሃ.ሃ ሲሆን ፺ ሜ.ሜ ሃ.ሃ ነው።",
    "ትኩሳቱ ፴፰ ነጥብ ፭ ዲግሪ ሴልሺየስ ደርሷል።",
    "የልብ ምቱ በደቂቃ ፺፪ ሲሆን ከፍ ያለ ነው።",
    "ክብደቱ ፷፪ ኪሎ ግራም ሲሆን ቁመቱ ፩ ሜትር ፷፭ ሴ.ሜ ነው።",
    "ሳምባ የሚቀበለው ኦክሲጅን መጠን ፺፯ ፐርሰንት ነው።",
    "የደም ስኳሩ ፻፳፮ ሚ.ሞ.ሊ ሊቴር ሲሆን ከፍ ብሏል።",
    "ትንፋሹ በደቂቃ ፳ ሲሆን ከፍ ያለ ምልክት ያሳያል።",
    "ሄሞግሎቢኑ ፱ ግ.ዲ.ኤ ሲሆን ዝቅ ያለ ደረጃ ነው።",
    "የደም ምርምር ውጤቱ ዶክተሩ አጥኑቶ ምላሽ ሰጥቷል።",
    "ሽንት ምርምሩ ባክቴሪያ ማሳየቱ ተረጋግጧል።",

    # Prescriptions
    "ፓራሲታሞል ፭፻ ሚ.ግ ሁለት ሁለት ጊዜ ለሰባት ቀን ይሰጣቸዋል።",
    "አሞክሲሲሊን ፭፻ ሚ.ግ ሦስት ጊዜ ለአምስት ቀን ታዟል።",
    "ሜትሮኒዳዞል ፭፻ ሚ.ግ ሁለት ጊዜ ለሰባት ቀን ይጠቀማሉ።",
    "ኦሜፕራዞል ፳ ሚ.ግ አንድ ጊዜ ጠዋት ምግብ በፊት ይዋጣ።",
    "አምሎዲፒን ፭ ሚ.ግ አንድ ጊዜ ዕለቱን ሙሉ ቀጥሎ ይዋጣ።",
    "ሜትፎርሚን ፭፻ ሚ.ግ ሁለት ጊዜ ምግብ ጋር ይወሰዳል።",
    "አቴኖሎል ፶ ሚ.ግ ጠዋት አንድ ጊዜ ቀጥሎ ይዋጣ።",
    "ዲክሎፌናክ ፶ ሚ.ግ ሁለት ጊዜ ከምግብ ጋር ይወሰዳ።",
    "ሲፕሮፍሎክሳሲን ፭፻ ሚ.ግ ሁለት ጊዜ ለሰባት ቀን ታዟል።",
    "ፎሊክ አሲድ ፭ ሚ.ግ አንድ ጊዜ ዕለቱን ሙሉ ቀጥሎ ሁለት ወር ይጠቀሙ።",
    "አይሮን ሱፕሊሜንት ሁለት ጊዜ ለሶስት ወር ይወሰዳ።",
    "ቫይታሚን ሲ ሁለት ጊዜ ፀሐይ ሲወጣ ሲቀር ይዋጣ።",

    # Clinical notes
    "ህሙሙ ለሁለት ሳምንት ከቆዩ በኋላ ዛሬ ለምርምር ቀርበዋል።",
    "ቀድሞ ስኳር ህሙምነት ስለነበራቸው ህክምና ቀጥሎ ይሰጣቸዋል።",
    "ቀዶ ጥገና ሊያስፈልጋቸው ስለሚችል ሐኪሙ ልዩ ምርምር ይሰጣቸዋል።",
    "ከሆስፒታሉ ሲወጡ ከሁለት ሳምንት በኋላ ቀጠሮ ተሰጥቷቸዋል።",
    "ህሙሙ ብዙ ውሃ እንዲጠጡ እና ጨው ያለው ምግብ እንዳይበሉ ታዟቸዋል።",
    "የደም ምርምር ውጤት ሲወጣ ወዲያው ሐኪሙን ማሳወቅ ያስፈልጋቸዋል።",
    "ቤተሰቦቻቸው ስለ ህሙሙ ሁኔታ ተነግሯቸው ተረዱ።",
    "ህሙሙ ዛሬ ህክምናቸውን ጀምሮ ቀጥሎ ይቀጥላሉ።",
    "ሌሎች ምልክቶች ከታዩ ወዲያው ሆስፒታሉ መምጣት አለባቸው።",
    "ህሙሙ ከሆስፒታሉ ፈቃድ ወጥተዋል የቀጠሮ ቀን ታስቀምጦላቸዋል።",
    "ከዚህ በፊት ደም ግፊት ህሙምነት ስለነበራቸው ሁልጊዜ ይቆጣጠሩ።",
    "ፀረ ባክቴሪያ ህክምናቸው ተሳክቶ ምልክቶቹ ቀንሰዋል።",
    "ህሙሙ አሁን ባለው ሁኔታ ተሻሽሎ ቤት ሊሄዱ ፈቃድ ተሰጥቷቸዋል።",
    "ሙሉ ምርምር ሲደረግ ሌላ ህሙምነት አለመኖሩ ተረጋግጧል።",
    "ህሙሙ ምግብ ለማዋጥ ስለሚቸገሩ ቀሪ ምርምር ታዟቸዋል።",
    "ቀጣዩ ቀጠሮ ከሦስት ሳምንት በኋላ ሲሆን ሁኔታቸው ይታያል።",
    "ሐኪሙ ለህሙሙ ሰፊ ማብራሪያ ሰጥቶ ወደ ቤት ሸኟቸዋል።",
    "ህሙሙ ተሰጣቸውን ሁሉ ለፈቃዳቸው ቀበሉ።",
    "ሆስፒታሉ ከሦስት ቀን ቆይታ በኋላ ዛሬ ወጡ።",
    "ሐኪሙ ቀዶ ጥገና ሳይደረግ ህሙምነቱ ሊቆም አልቻለም አለ።",
]

random.shuffle(SENTENCES)

def wrap_text(text, font, max_width, draw):
    """Wrap text to fit within max_width pixels."""
    words = text.split(" ")
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

def generate_image(sentences):
    font_size  = random.randint(20, 26)
    margin_x   = random.randint(30, 60)
    margin_y   = random.randint(25, 40)
    line_gap   = random.randint(4, 10)
    img_width  = random.randint(600, 900)
    bg_shade   = random.randint(245, 255)
    text_shade = random.randint(5, 35)

    try:
        font = ImageFont.truetype(FONT_PATH, font_size)
    except Exception as e:
        raise RuntimeError(f"Font not found: {FONT_PATH}\n{e}")

    # Dummy draw to measure text
    dummy = Image.new("RGB", (img_width, 100))
    draw  = ImageDraw.Draw(dummy)

    max_text_width = img_width - margin_x * 2

    # Wrap each sentence and build all rendered lines
    rendered_lines = []
    for sent in sentences:
        wrapped = wrap_text(sent, font, max_text_width, draw)
        rendered_lines.extend(wrapped)

    # Measure line height
    bbox = draw.textbbox((0, 0), "አ", font=font)
    line_height = (bbox[3] - bbox[1]) + line_gap

    img_height = margin_y * 2 + line_height * len(rendered_lines) + line_gap * 2
    img_height = max(img_height, 150)

    # Create final image
    bg  = (bg_shade, bg_shade, bg_shade)
    img = Image.new("RGB", (img_width, img_height), color=bg)
    draw = ImageDraw.Draw(img)

    y = margin_y
    for line in rendered_lines:
        x_jitter = random.randint(-3, 3)
        shade    = text_shade + random.randint(0, 10)
        draw.text((margin_x + x_jitter, y), line, font=font, fill=(shade, shade, shade))
        y += line_height

    # Noise
    arr   = np.array(img)
    noise = np.random.randint(-8, 8, arr.shape, dtype=np.int16)
    arr   = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    img   = Image.fromarray(arr)

    # Occasional blur
    if random.random() < 0.25:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.7)))

    # Occasional slight rotation
    if random.random() < 0.15:
        angle = random.uniform(-1.0, 1.0)
        img   = img.rotate(angle, fillcolor=bg, expand=False)

    return img, rendered_lines

def generate_dataset(n=800):
    records = []
    print(f"Generating {n} images with Noto Serif Ethiopic font...")

    for i in range(n):
        n_sents = random.randint(5, 9)
        sentences = random.sample(SENTENCES, min(n_sents, len(SENTENCES)))

        try:
            img, rendered_lines = generate_image(sentences)
        except RuntimeError as e:
            print(f"ERROR: {e}")
            return

        filename = f"doc_{i:05d}.png"
        img.save(IMG_DIR / filename, "PNG")

        label = "\n".join(sentences)
        records.append({"filename": filename, "text": label, "n_lines": len(rendered_lines)})

        if (i + 1) % 100 == 0:
            print(f"  {i+1}/{n} done")

    with open(LABEL_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "text", "n_lines"])
        writer.writeheader()
        writer.writerows(records)

    print(f"\nDone! {n} images saved to {IMG_DIR}")
    print(f"Labels: {LABEL_CSV}")
    print("\nSample:")
    for r in records[:2]:
        print(f"  {r['filename']}: {r['text'][:80]}...")

if __name__ == "__main__":
    generate_dataset(800)
