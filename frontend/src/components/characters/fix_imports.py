import os
import re

directory = '.'

for filename in os.listdir(directory):
    if filename.endswith("Character.tsx"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as f:
            content = f.read()

        # Remove "useId, " everywhere to clean up the mess
        content = content.replace("useId, ", "")
        
        # Add useId to the React import line
        # e.g., import React, { useEffect... } from 'react';
        # or import { useEffect... } from 'react';
        
        # We find the react import
        react_import_match = re.search(r'import\s+(?:React,\s+)?\{([^}]+)\}\s+from\s+[\'"]react[\'"]', content)
        if react_import_match:
            inner_imports = react_import_match.group(1)
            # Add useId if not there
            if "useId" not in inner_imports:
                new_inner = f"useId, {inner_imports.strip()}"
                content = content.replace(inner_imports, new_inner)
        else:
            # Maybe there is no destructured import from react
            # e.g., import * as React from 'react';
            content = "import { useId } from 'react';\n" + content

        with open(filepath, 'w') as f:
            f.write(content)

print("Imports fixed")
