import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # 1. LessonRunner specific fixes
    if 'LessonRunner.tsx' in filepath:
        content = content.replace('lp lp-bg', 'bg-slate-50')
        # Wrap the activities switch in an island
        # Actually, let's just make sure the main container is clean
        content = content.replace('className="lp-card relative lesson-speech', 'className="bg-white rounded-[2.5rem] shadow-sm relative lesson-speech')
        
    elif 'LessonCelebration.tsx' in filepath:
        content = content.replace('lp lp-bg', 'bg-slate-50')
        content = content.replace('lp-card', 'bg-white rounded-[2.5rem] shadow-sm')

    else:
        # General activity / UI components replacements
        content = content.replace('lp-card', 'bg-white rounded-[2.5rem] shadow-sm')
        content = content.replace('lp-chip', 'bg-white rounded-full shadow-sm')
        # Remove dark mode backgrounds that make it look dirty
        content = re.sub(r'dark:bg-slate-[89]00', '', content)
        content = re.sub(r'dark:bg-slate-700', '', content)
        # Remove ambient glows
        content = re.sub(r'shadow-glow[^\s"\'\`]*', 'shadow-sm', content)
        content = re.sub(r'shadow-\[0_0_15px_[^\]]+\]', 'shadow-sm', content)
        content = re.sub(r'ring-\w+-\d+', '', content)
        # Change rounded-2xl to rounded-full for buttons or small interactive elements
        # It's safer to just replace it in known button components, but let's do a broad sweep for standard UI
        content = content.replace('rounded-2xl', 'rounded-full')
        content = content.replace('rounded-xl', 'rounded-full')

    if original != content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

engine_dir = 'frontend/src/components/lessons/engine'
changed_count = 0

for root, dirs, files in os.walk(engine_dir):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            if process_file(filepath):
                changed_count += 1
                print(f"Updated {filepath}")

print(f"Total files changed: {changed_count}")
