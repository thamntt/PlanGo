/**
 * Custom lint-staged config that excludes admin-plango from root ESLint
 * (it has its own subproject with its own eslint config + deps).
 */
const path = require("path");

function quote(file) {
  return `"${file}"`;
}

function isAdminFile(file) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  return rel.startsWith("admin-plango/");
}

module.exports = {
  "*.{ts,tsx,js,jsx}": (filenames) => {
    const cmds = [];
    if (filenames.length > 0) {
      cmds.push(`prettier --write ${filenames.map(quote).join(" ")}`);
    }
    const eligible = filenames.filter((f) => !isAdminFile(f));
    if (eligible.length > 0) {
      cmds.push(`eslint --fix ${eligible.map(quote).join(" ")}`);
    }
    return cmds;
  },
  "*.{json,md,yml,yaml}": "prettier --write",
};
