# Переинициализируем с правильными правами
cd /home/coin
rm -rf legacybtc-pool/.git
cd legacybtc-pool
git init
git config user.email "myshopper.club@gmail.com"
git config user.name "forks-ecosystem"
git add .
git commit -m "Initial commit: LegacyBTC Pool"
git remote add origin https://github.com/forks-ecosystem/legacybtc-pool.git
git branch -M main
git push -u origin main