const fs = require('fs');
const path = require('path');

// Fix the popup.html in dist/public/ (if it exists)
const publicHtmlPath = path.join(__dirname, 'dist', 'public', 'popup.html');
if (fs.existsSync(publicHtmlPath)) {
  let html = fs.readFileSync(publicHtmlPath, 'utf8');
  html = html.replace(/src="\/popup\.js"/g, 'src="../popup.js"');
  html = html.replace(/href="\/popup\.css"/g, 'href="../popup.css"');
  fs.writeFileSync(publicHtmlPath, html);
  console.log('Fixed paths in dist/public/popup.html');
}

// Fix the popup.html in dist/ root (the one actually used by the extension)
const rootHtmlPath = path.join(__dirname, 'dist', 'popup.html');
if (fs.existsSync(rootHtmlPath)) {
  let html = fs.readFileSync(rootHtmlPath, 'utf8');
  // Replace the source path with the correct built file
  html = html.replace(/src="\/src\/main\.jsx"/g, 'src="./popup.js"');
  // Add the CSS link if it doesn't exist
  if (!html.includes('popup.css')) {
    html = html.replace('</head>', '    <link rel="stylesheet" crossorigin href="./popup.css">\n  </head>');
  }
  fs.writeFileSync(rootHtmlPath, html);
  console.log('Fixed paths in dist/popup.html');
}
