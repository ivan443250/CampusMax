# Лёгкий образ с nginx
FROM nginx:alpine

# Удаляем дефолтную страницу nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем весь фронтенд в корень nginx
COPY . /usr/share/nginx/html

# По умолчанию nginx слушает 80 порт
EXPOSE 80

# Стандартный старт nginx
CMD ["nginx", "-g", "daemon off;"]
