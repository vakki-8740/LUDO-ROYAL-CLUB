# Ludo Royal Club - Payment Server (Render free tier)
FROM php:8.2-apache

# curl extension (Razorpay + Google calls ke liye), openssl pehle se hota hai
RUN apt-get update \
 && apt-get install -y libcurl4-openssl-dev \
 && docker-php-ext-install curl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Saari files (config.php ko chodkar — wo env vars se aayegi)
COPY . /var/www/html/

EXPOSE 80
