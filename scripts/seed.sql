-- ==============================================================================
-- BẢNG ĐỘC LẬP (Không chứa Foreign Key)
-- ==============================================================================

CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Destination_Type (
    destinationtype_id SERIAL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE POI_Type (
    poitype_id SERIAL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE Preferences (
    preference_id SERIAL PRIMARY KEY,
    preference_name VARCHAR(255) NOT NULL
);

CREATE TABLE ExpenseType (
    expense_type_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- ==============================================================================
-- BẢNG CẤP 1 (Chứa Foreign Key tham chiếu đến bảng độc lập)
-- ==============================================================================

CREATE TABLE Destinations (
    destination_id SERIAL PRIMARY KEY,
    destinationType_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    google_place_id VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    images JSONB, -- PostgreSQL hỗ trợ rất tốt JSONB cho mảng hình ảnh
    rating DECIMAL(3,2),
    review_counts INT DEFAULT 0,
    FOREIGN KEY (destinationType_id) REFERENCES Destination_Type(destinationtype_id)
);

-- ==============================================================================
-- BẢNG CẤP 2 
-- ==============================================================================

CREATE TABLE POIs (
    poi_id SERIAL PRIMARY KEY,
    poitype_id INT,
    destination_id INT,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    address TEXT,
    estimated_cost DECIMAL(12,2),
    rating DECIMAL(3,2),
    review_counts INT DEFAULT 0,
    google_place_id VARCHAR(255),
    FOREIGN KEY (poitype_id) REFERENCES POI_Type(poitype_id),
    FOREIGN KEY (destination_id) REFERENCES Destinations(destination_id)
);

CREATE TABLE Trips (
    trip_id SERIAL PRIMARY KEY,
    destination_id INT,
    owner_id INT,
    title VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    num_people INT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invitation_token VARCHAR(255),
    FOREIGN KEY (destination_id) REFERENCES Destinations(destination_id),
    FOREIGN KEY (owner_id) REFERENCES Users(user_id)
);

-- ==============================================================================
-- BẢNG CẤP 3 (Các bảng phụ thuộc POIs, Trips và bảng Mapping/N-N)
-- ==============================================================================

CREATE TABLE POI_Opening_Hours (
    poi_id INT,
    day_of_week INT, -- 0-6 cho Chủ Nhật - Thứ 7
    open_time TIME,
    close_time TIME,
    PRIMARY KEY (poi_id, day_of_week),
    FOREIGN KEY (poi_id) REFERENCES POIs(poi_id) ON DELETE CASCADE
);

CREATE TABLE POI_Preferences (
    poi_id INT,
    preference_id INT,
    PRIMARY KEY (poi_id, preference_id),
    FOREIGN KEY (poi_id) REFERENCES POIs(poi_id) ON DELETE CASCADE,
    FOREIGN KEY (preference_id) REFERENCES Preferences(preference_id) ON DELETE CASCADE
);

CREATE TABLE Trip_Members (
    trip_id INT,
    user_id INT,
    role VARCHAR(50),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, user_id),
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Trip_Preferences (
    trip_id INT,
    preference_id INT,
    PRIMARY KEY (trip_id, preference_id),
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (preference_id) REFERENCES Preferences(preference_id) ON DELETE CASCADE
);

CREATE TABLE ItineraryDay (
    day_id SERIAL PRIMARY KEY,
    trip_id INT,
    date DATE,
    day_index INT,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE
);

CREATE TABLE Trip_Reviews (
    user_id INT,
    trip_id INT,
    rating DECIMAL(3,2),
    comment TEXT,
    PRIMARY KEY (user_id, trip_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE
);

CREATE TABLE Notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT,
    trip_id INT NULL, 
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE SET NULL
);

-- ==============================================================================
-- BẢNG CẤP 4 (Itinerary Items & References)
-- ==============================================================================

CREATE TABLE Itinerary_Items (
    item_id SERIAL PRIMARY KEY,
    day_id INT,
    poi_id INT,
    custom_name VARCHAR(255),
    start_time TIME,
    duration INT, -- Tính bằng phút
    order_index INT,
    note TEXT,
    estimated_cost DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    status VARCHAR(50),
    FOREIGN KEY (day_id) REFERENCES ItineraryDay(day_id) ON DELETE CASCADE,
    FOREIGN KEY (poi_id) REFERENCES POIs(poi_id)
);

CREATE TABLE Item_Reviews (
    user_id INT,
    item_id INT,
    rating DECIMAL(3,2),
    comment TEXT,
    PRIMARY KEY (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Itinerary_Items(item_id) ON DELETE CASCADE
);

CREATE TABLE Expenses (
    expense_id SERIAL PRIMARY KEY,
    trip_id INT,
    item_id INT NULL, 
    paid_by INT,
    expense_type_id INT,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    split_method VARCHAR(50),
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Itinerary_Items(item_id) ON DELETE SET NULL,
    FOREIGN KEY (paid_by) REFERENCES Users(user_id),
    FOREIGN KEY (expense_type_id) REFERENCES ExpenseType(expense_type_id)
);

-- ==============================================================================
-- BẢNG CẤP 5 (Phụ thuộc vào Expenses)
-- ==============================================================================

CREATE TABLE Expense_Splits (
    split_id SERIAL PRIMARY KEY,
    expense_id INT,
    user_id INT,
    amount DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Notes (
    note_id SERIAL PRIMARY KEY,
    expense_id INT NULL, 
    item_id INT NULL,    
    user_id INT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Itinerary_Items(item_id) ON DELETE CASCADE
);