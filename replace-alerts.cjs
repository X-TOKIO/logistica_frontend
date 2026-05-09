const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.tsx')) results.push(file);
        }
    });
    return results;
}

const files = walk('C:/Users/X-TOKIO/Desktop/logistica/frontend/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('alert(')) {
        content = content.replace(/alert\((['"`])(.*guardad.*)['"`]\)/gi, "toast.success($1$2$1)");
        content = content.replace(/alert\((['"`])(.*Éxito.*)['"`]\)/gi, "toast.success($1$2$1)");
        content = content.replace(/alert\((['"`])(.*xito.*)['"`]\)/gi, "toast.success($1$2$1)");
        content = content.replace(/alert\((['"`])(.*Asign.*)['"`]\)/gi, "toast.success($1$2$1)");
        
        // Everything else to toast.error
        content = content.replace(/alert\(/g, "toast.error(");
        
        if (!content.includes("import { toast } from 'sonner';") && !content.includes('import { toast } from "sonner";')) {
            content = "import { toast } from 'sonner';\n" + content;
        }
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated: ' + file);
    }
});
