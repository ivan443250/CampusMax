KEY_MAP: dict[str, str] = {
    # === Название предмета / дисциплины ===
        "subject": "subject",
        "предмет": "subject",
        "дисциплина": "subject",
        "дисципл.": "subject",
        "учебная дисциплина": "subject",
        "название дисциплины": "subject",
        "название предмета": "subject",
        "курс": "subject",          # часто так пишут в выгрузках
        "course": "subject",
        "course name": "subject",
        "subject name": "subject",
        "module": "subject",
        "module name": "subject",

        # === Преподаватель / ФИО ===
        "teacher": "teacher",
        "преподаватель": "teacher",
        "преп.": "teacher",
        "преподаватель(и)": "teacher",
        "фио преподавателя": "teacher",
        "фио преп.": "teacher",
        "фио": "teacher",  # иногда столбец просто 'ФИО'
        "лектор": "teacher",
        "лектор(ы)": "teacher",
        "семинарист": "teacher",
        "практик": "teacher",
        "преподаватель лекции": "teacher",
        "преподаватель практики": "teacher",
        "lector": "teacher",
        "lecturer": "teacher",
        "tutor": "teacher",
        "instructor": "teacher",
        "professor": "teacher",
        "prof.": "teacher",

        # === Аудитория / место проведения ===
        "room": "room",
        "аудитория": "room",
        "ауд.": "room",
        "аудит.": "room",
        "кабинет": "room",
        "каб.": "room",
        "помещение": "room",
        "место проведения": "room",
        "место занятия": "room",
        "место занятий": "room",
        "место": "room",
        "зал": "room",
        "актовый зал": "room",
        "спортзал": "room",   # иногда это именно колонка
        "laboratory": "room",
        "lab": "room",
        "lab.": "room",
        "room number": "room",
        "auditorium": "room",
        "cabinet": "room",
        "classroom": "room",
        "location": "room",
        "venue": "room",

        # === Время (диапазон) ===
        "time": "time",
        "время": "time",
        "время занятия": "time",
        "время проведения": "time",
        "время пары": "time",
        "пара": "time",            # иногда в этот столбец пишут именно "9:00-10:30"
        "время урока": "time",
        "lesson time": "time",
        "class time": "time",
        "time range": "time",
        "period": "time",
        "slot": "time",

        # === Начало пары ===
        "start_time": "start_time",
        "начало": "start_time",
        "начало пары": "start_time",
        "начало занятия": "start_time",
        "время начала": "start_time",
        "from": "start_time",
        "start": "start_time",
        "start time": "start_time",
        "begin": "start_time",
        "begin time": "start_time",

        # === Конец пары ===
        "end_time": "end_time",
        "конец": "end_time",
        "конец пары": "end_time",
        "конец занятия": "end_time",
        "окончание": "end_time",
        "окончание пары": "end_time",
        "окончание занятия": "end_time",
        "время окончания": "end_time",
        "to": "end_time",
        "end": "end_time",
        "end time": "end_time",
        "finish": "end_time",

        # === День недели ===
        "weekday": "weekday",
        "день": "weekday",
        "день недели": "weekday",
        "день_недели": "weekday",
        "day": "weekday",
        "day of week": "weekday",
        "weekday name": "weekday",

        # === Дата ===
        "date": "date",
        "дата": "date",
        "дата занятия": "date",
        "calendar date": "date",

        # === Группа / поток ===
        "group": "group",
        "группа": "group",
        "гр.": "group",
        "учебная группа": "group",
        "академическая группа": "group",
        "academic group": "group",
        "study group": "group",
        "класс": "group",
        "class": "group",
        "stream": "group",
        "поток": "group",

        # === Подгруппа ===
        "subgroup": "subgroup",
        "подгруппа": "subgroup",
        "подгр.": "subgroup",
        "гр.подг.": "subgroup",
        "группа/подгруппа": "subgroup",
        "sub-group": "subgroup",
        "group part": "subgroup",

        # === Тип недели / чётность ===
        "week_type": "week_type",
        "тип недели": "week_type",
        "чётность": "week_type",
        "четность": "week_type",
        "чет/нечет": "week_type",
        "четн/нечетн": "week_type",
        "week type": "week_type",      # из теста 3
        "type of week": "week_type",
        "week parity": "week_type",
        "parity": "week_type",
        "неделя": "week_type",         # иногда пишут 'чётная/нечётная' прямо в колонке 'Неделя'
        "номер недели": "week_type",   # встречается как '1-16', '1-8', 'чётные'

        # === Комментарии / примечания ===
        "note": "note",
        "примечание": "note",
        "прим.": "note",
        "комментарий": "note",
        "коммент": "note",
        "comment": "note",
        "remarks": "note",
        "details": "note",
        "extra": "note",
        "описание": "note",
        "описание занятия": "note",
        "формат": "note",          # лекция/семинар/онлайн оффлайн
        "форма": "note",
        "вид занятия": "note",
}

# порядок дней недели для сортировки
WEEKDAY_ORDER = {
    "понедельник": 1,
    "вторник": 2,
    "среда": 3,
    "четверг": 4,
    "пятница": 5,
    "суббота": 6,
    "воскресенье": 7,
    # на всякий — англ варианты:
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
    "sunday": 7,
    "пн": 1,
    "вт": 2,
    "ср": 3,
    "чт": 4,
    "пт": 5,
}

# известные начала пар, чтобы номера совпадали с реальными
PAIR_START_TIMES = [
    "08:30",
    "09:00",
    "10:40",
    "11:20",
    "13:00",
    "15:00",
    "15:10",
    "17:00",
    "18:10",
]