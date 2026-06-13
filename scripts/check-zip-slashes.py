import struct, sys

BACKSLASH = bytes([92])  # '\'

def raw_names(path):
    data = open(path, "rb").read()
    names = []
    i = 0
    sig = b"PK\x01\x02"  # central directory header
    while True:
        i = data.find(sig, i)
        if i < 0:
            break
        n = struct.unpack("<H", data[i + 28:i + 30])[0]
        names.append(data[i + 46:i + 46 + n])
        i += 46 + n
    return names

for p in ["aoe4-overlay_test.zip", "aoe4-overlay_0.0.2.zip", "aoe4-overlay.zip"]:
    full = "d:/Yanis/Desktop/projet_code/aoe4units/" + p
    try:
        ns = raw_names(full)
    except FileNotFoundError:
        print(p, "NOT FOUND")
        continue
    bs = sum(1 for x in ns if BACKSLASH in x)
    sample = next((x for x in ns if b"mo.png" in x and b"flag" in x.lower()), None)
    print(p, "-> backslash entries:", bs, "/", len(ns), "| sample:", sample)
