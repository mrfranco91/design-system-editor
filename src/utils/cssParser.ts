export interface CssVariable {
  id: string; // Unique identifier (using index)
  name: string;
  value: string;
  startIndex: number; // Index of the value start in original string
  endIndex: number; // Index of the value end in original string
  selector: string; // The selector this variable belongs to (e.g., :root, .dark)
}

export function parseCssVariables(css: string): CssVariable[] {
  const variables: CssVariable[] = [];
  let currentSelector = '';
  let braceDepth = 0;
  let inComment = false;
  let inString: string | null = null; // ' or "
  
  // Helper to capture selector buffer
  let buffer = '';
  
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const nextChar = css[i + 1];

    // Handle Comments
    if (!inString && !inComment && char === '/' && nextChar === '*') {
      inComment = true;
      i++; // Skip *
      continue;
    }
    if (inComment && char === '*' && nextChar === '/') {
      inComment = false;
      i++; // Skip /
      continue;
    }
    if (inComment) continue;

    // Handle Strings
    if (!inString && (char === '"' || char === "'")) {
      inString = char;
      continue;
    }
    if (inString === char && css[i - 1] !== '\\') {
      inString = null;
      continue;
    }
    if (inString) continue;

    // Handle Blocks
    if (char === '{') {
      if (braceDepth === 0) {
        currentSelector = buffer.trim();
      }
      buffer = '';
      braceDepth++;
      continue;
    }
    if (char === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        currentSelector = '';
      }
      buffer = '';
      continue;
    }

    // Handle Variable Detection
    // We look for "--" at the start of a property
    // A property starts after a semicolon, open brace, or at the start of the block
    // But simpler: look for "--" followed by name, colon, value, semicolon
    
    // Optimization: Only check for variables if we are inside a block
    if (braceDepth > 0) {
      // Check if this is the start of a variable declaration
      // It must be preceded by { or ; or whitespace
      // And start with --
      
      // We'll use a local lookahead for the pattern: --name: value;
      if (char === '-' && nextChar === '-') {
        // Potential variable
        const remainder = css.slice(i);
        // Regex to match strictly: --[name]: [value];
        // We match until the first semicolon that isn't in a string/comment (simplified here since we are already parsing char by char, 
        // but for the value extraction, we can scan forward)
        
        // Let's scan forward manually to find the colon and semicolon
        let j = i;
        let colonIndex = -1;
        let semicolonIndex = -1;
        let tempInString: string | null = null;
        
        // Scan for name and colon
        while (j < css.length) {
          const c = css[j];
          if (c === ':' && !tempInString) {
            colonIndex = j;
            break;
          }
          if ((c === '"' || c === "'") && css[j-1] !== '\\') {
             if (tempInString === c) tempInString = null;
             else if (!tempInString) tempInString = c;
          }
          if ((c === ';' || c === '}') && !tempInString) {
            // Reached end without colon, not a property
            break;
          }
          j++;
        }

        if (colonIndex > -1) {
          const name = css.slice(i, colonIndex).trim();
          // Verify name validity (simple check)
          if (name.match(/^--[a-zA-Z0-9-_]+$/)) {
            // Now find value end (semicolon or closing brace)
            let k = colonIndex + 1;
            let valueEndIndex = -1;
            let tempInStringVal: string | null = null;
            let tempParenDepth = 0; // For var(--foo)

            while (k < css.length) {
              const c = css[k];
              
              if ((c === '"' || c === "'") && css[k-1] !== '\\') {
                 if (tempInStringVal === c) tempInStringVal = null;
                 else if (!tempInStringVal) tempInStringVal = c;
              }
              
              if (!tempInStringVal) {
                 if (c === '(') tempParenDepth++;
                 else if (c === ')') tempParenDepth--;
                 else if ((c === ';' || c === '}') && tempParenDepth === 0) {
                    valueEndIndex = k;
                    break;
                 }
              }
              k++;
            }

            if (valueEndIndex > -1) {
              // We found a variable!
              const valueStartIndex = colonIndex + 1;
              const rawValue = css.slice(valueStartIndex, valueEndIndex);
              
              // We want the value *trimmed* for display, but we need exact indices for replacement.
              // The prompt says: "Replace only the substring between colon and semicolon."
              // So we store the EXACT indices between colon and semicolon/brace.
              
              variables.push({
                id: `${i}-${valueStartIndex}`,
                name: name,
                value: rawValue, // This is the raw content including whitespace
                startIndex: valueStartIndex,
                endIndex: valueEndIndex,
                selector: currentSelector || 'Global'
              });

              // Advance main loop to end of this variable
              // If we ended on a brace '}', we must NOT skip it, so the main loop can process it to decrement braceDepth
              // If we ended on a semicolon ';', we can skip it.
              
              if (css[valueEndIndex] === '}') {
                i = valueEndIndex - 1; // Next iteration will be valueEndIndex (the brace)
              } else {
                i = valueEndIndex; // Next iteration will be valueEndIndex + 1 (char after semicolon)
              }
              continue; 
            }
          }
        }
      }
    }

    if (braceDepth === 0) {
      buffer += char;
    }
  }

  return variables;
}

export function patchCss(originalCss: string, variables: CssVariable[], modifiedValues: Record<string, string>): string {
  // Sort variables by start index descending to patch from end to start
  // This prevents index shifting
  const sortedVars = [...variables].sort((a, b) => b.startIndex - a.startIndex);
  
  let patched = originalCss;
  
  for (const v of sortedVars) {
    if (modifiedValues[v.id] !== undefined && modifiedValues[v.id] !== v.value) {
      const before = patched.slice(0, v.startIndex);
      const after = patched.slice(v.endIndex);
      patched = before + modifiedValues[v.id] + after;
    }
  }
  
  return patched;
}
