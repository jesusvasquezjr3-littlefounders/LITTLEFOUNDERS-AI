import os
import re

directory = '.'

for filename in os.listdir(directory):
    if filename.endswith("Character.tsx"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as f:
            content = f.read()

        # Add useId import if not there
        if "useId" not in content:
            content = content.replace("import React, {", "import React, { useId,")
            if "import React, {" not in content: # fallback
                 content = content.replace("import {", "import { useId,")

        # Find the component definition
        # Look for: export const DinaCharacter: React.FC<...> = ({...}) => {
        # or export function DinoCharacter({...}) {
        
        # We'll just inject `const uid = useId().replace(/:/g, "");` right after the first '{' of the function body.
        # This is tricky with regex, so we'll do something simpler:
        # replace `const [isBlinking` or `const headRef` with `const uid = useId().replace(/:/g, "");\n    const [isBlinking`
        if "const uid =" not in content:
            content = re.sub(r'(const \w+Ref = useRef)', r'const uid = useId().replace(/:/g, "");\n    \1', content, count=1)

        # Now replace id="something" with id={`something-${uid}`}
        # but only inside the <defs> or <g> or <path> etc.
        # It's easier to find all id="([^"]+)" and replace with id={`\1-${uid}`}
        # AND we must also replace url(#something) with url(#something-${uid})
        # AND fill="url(#something)" with fill={`url(#something-${uid})`}
        
        # Find all id="xyz"
        ids = re.findall(r'id="([^"]+)"', content)
        # Filter out anything that's not a valid SVG ID we want to replace (like simple words, but let's just replace all of them)
        ids = list(set(ids))
        
        for id_val in ids:
            if "{" in id_val or "$" in id_val: continue
            
            # Replace id="xyz" with id={`xyz-${uid}`}
            content = content.replace(f'id="{id_val}"', f'id={{`{id_val}-${{uid}}`}}')
            
            # Replace url(#xyz) inside strings like filter="url(#xyz)"
            # we can't easily do string replacement if it's in a string literal.
            # E.g. filter="url(#dinaShadow)" -> filter={`url(#dinaShadow-${uid})`}
            content = re.sub(rf'(filter|fill|clipPath)="url\(#{id_val}\)"', rf'\1={{`url(#{id_val}-${{uid}})`}}', content)

        with open(filepath, 'w') as f:
            f.write(content)

print("Done")
