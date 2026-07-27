eval "$(ssh-agent -s)"
ssh-add ~/.ssh/forks-ecosystem

cd /home/coin/legacybtc-pool

git config user.email "myshopper.club@gmail.com"
git config user.name "forks-ecosystem"

git add .
git commit -m "Add postgresql-data to .gitignore, update admin panel"
git remote add origin git@github.com:forks-ecosystem/legacybtc-pool.git 2>/dev/null
git branch -M main
git push -u origin main

ssh-agent -k
