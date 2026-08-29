const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}`;

const replacement = `function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const id = hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}`;

code = code.replace(target, replacement);

// Fallback in case of \r\n
const targetCRLF = target.replace(/\n/g, '\r\n');
code = code.replace(targetCRLF, replacement);

fs.writeFileSync('src/App.tsx', code);
