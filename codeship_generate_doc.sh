#!/bin/bash
set -e # exit with nonzero exit code if anything fails

# http://stackoverflow.com/questions/307503/whats-the-best-way-to-check-that-environment-variables-are-set-in-unix-shellscr
: ${GIT_URL?"Need to set variable: GIT_URL"}
: ${GIT_NAME?"Need to set variable: GIT_NAME"}
: ${GIT_MAIL?"Need to set variable: GIT_MAIL"}

cd doc/api

# Clear and re-create the out directory
rm -rf target || exit 0
mkdir target

# Install Aglio to generate the documentation from markdown
echo "Install aglio"
npm install -g aglio > /dev/null 2>&1

# Generate the documentation
echo "Call aglio"
aglio --theme-template triple --theme-variables streak --theme-style default --theme-style theme.less -i index.apib -o index.html  > /dev/null 2>&1

# Push generated documentation to gh-pages Github branch
cd target
git init
git remote add origin "${GIT_URL}"
git fetch origin gh-pages:refs/remotes/origin/gh-pages 
git checkout gh-pages 
git config user.name "${GIT_NAME}"
git config user.email "${GIT_MAIL}"
cp ../index.html index.html
git add index.html

if [ -n "$(git status --porcelain)" ]; then 
	git commit -m 'Deploy to GitHub Pages [skip ci]'
	git push origin gh-pages
else 
  echo "No changes"
fi
