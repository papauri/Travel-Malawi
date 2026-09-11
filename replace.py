import glob
import re

files = glob.glob('server/docs/*.md')
files.append('SECURITY.md')

replacements = [
    (r'\[Lodge Name\]', '[Hotel/Resort/Lodge Name]'),
    (r'Lodge Manager', 'Property Manager'),
    (r'lodge manager', 'property manager'),
    (r'Lodge Owners', 'Property Owners'),
    (r'lodge owners', 'property owners'),
    (r'Lodge Owner', 'Property Owner'),
    (r'lodge owner', 'property owner'),
    (r'Lodge Acquisition', 'Property Acquisition'),
    (r'Lodge Showcase', 'Property Showcase'),
    (r'Lodge Stays', 'Property Stays'),
    (r'Lodge & Hotel Partners', 'Hotel, Resort, & Lodge Partners'),
    (r'Malawian Lodges', 'Malawian Hotels, Resorts, & Lodges'),
    (r'Malawian lodges', 'Malawian hotels, resorts, & lodges'),
    (r'Top Lodges', 'Top Hotels, Resorts, & Lodges'),
    (r'top lodges', 'top hotels, resorts, & lodges'),
    (r'Core Lodges', 'Core Properties'),
    (r'Active Lodges', 'Active Properties'),
    (r'Verified Lodges', 'Verified Properties'),
    (r'Target Lodges', 'Target Properties'),
    (r'lodge partners', 'property partners'),
    (r'Lodge partners', 'Property partners'),
    (r'Lodge Partners', 'Property Partners'),
    (r'lodge partner', 'property partner'),
    (r'Lodge Partner', 'Property Partner'),
    (r'Lodge Listing', 'Property Listing'),
    (r'lodge listing', 'property listing'),
    (r'Lodge Showcase', 'Property Showcase'),
    (r'Lodge Showcase', 'Property Showcase'),
    (r'lodge showcase', 'property showcase'),
    (r'Lodge Does It', 'Host Does It'),
    (r'Lodge submits', 'Host submits'),
    (r'Lodge asks', 'Property asks'),
    (r'\blodges, B&Bs', 'hotels, resorts, lodges, B&Bs'),
    (r'\bLodges, B&Bs', 'Hotels, resorts, lodges, B&Bs'),
    (r'lodges, cottages', 'hotels, resorts, lodges, cottages'),
    (r'Lodges, cottages', 'Hotels, resorts, lodges, cottages'),
    (r'lodge, hotel, or camp', 'hotel, resort, lodge, or camp'),
    (r'lodge, B&B', 'hotel, resort, lodge, B&B'),
    (r'lodges and beach cottages', 'hotels, resorts, lodges, and beach cottages'),
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        orig_content = content
        for old, new in replacements:
            content = re.sub(old, new, content)
            
        # specifically fix "lodges" to "hotels, resorts, and lodges" where it's isolated
        content = re.sub(r'(?<![A-Za-z])lodges(?![A-Za-z])(?!\s*(?:,|and|&))', 'hotels, resorts, and lodges', content)
        content = re.sub(r'(?<![A-Za-z])Lodges(?![A-Za-z])(?!\s*(?:,|and|&))', 'Hotels, resorts, and lodges', content)
        # same for singular
        content = re.sub(r'(?<![A-Za-z])a lodge(?![A-Za-z])', 'a hotel, resort, or lodge', content)
        content = re.sub(r'(?<![A-Za-z])A lodge(?![A-Za-z])', 'A hotel, resort, or lodge', content)
        content = re.sub(r'(?<![A-Za-z])the lodge(?![A-Za-z])', 'the property', content)
        content = re.sub(r'(?<![A-Za-z])The lodge(?![A-Za-z])', 'The property', content)
        content = re.sub(r'(?<![A-Za-z])Lodge:(?![A-Za-z])', 'Property:', content)

        if content != orig_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
    except Exception as e:
        pass
