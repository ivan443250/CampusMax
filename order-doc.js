// order-doc.js

/**
 * Функция для обработки заказа справки
 */
function orderDocument() {
    const documentType = document.getElementById("documentType").value;
    const department = document.getElementById("department").value;
    const comments = document.getElementById("comments").value;
    const isElectronic = document.getElementById("isElectronic").checked;

    // Формируем сообщение с заказом
    const orderSummary = `
        Тип справки: ${documentType}\n
        Корпус выдачи: ${department}\n
        Комментарии: ${comments}\n
        Электронная справка: ${isElectronic ? "Да" : "Нет"}
    `;

    // Показываем информацию в консоли (или можно вывести на экран)
    alert("Ваш заказ на справку успешно оформлен!\n\n" + orderSummary);

    // Для отображения на странице (например, чтобы отобразить в div или modal)
    document.getElementById("orderSummary").textContent = orderSummary;
}

// Привязываем обработчик к кнопке "Заказать справку"
document.getElementById("submitDocRequestBtn").addEventListener("click", orderDocument);
