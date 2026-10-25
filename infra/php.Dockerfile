FROM php:8.4-fpm-alpine AS base
RUN apk add --no-cache icu-libs libpq libzip oniguruma gmp \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev postgresql-dev libzip-dev oniguruma-dev gmp-dev \
    && docker-php-ext-install -j2 pdo_pgsql intl mbstring bcmath opcache zip gmp \
    && apk del .build-deps
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/backend
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY backend ./
RUN composer dump-autoload --no-dev --optimize --no-scripts \
    && mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
COPY infra/php.ini /usr/local/etc/php/conf.d/trekfin.ini
COPY infra/entrypoint.sh /usr/local/bin/trekfin-entrypoint
RUN chmod +x /usr/local/bin/trekfin-entrypoint
ENTRYPOINT ["trekfin-entrypoint"]
CMD ["php-fpm"]
