// Language System - Arabic/English Support
// Save this as language.js

const translations = {
    en: {
        // Common
        appTitle: "My Recipe Book",
        appSubtitle: "Create your personal collection of delicious recipes",
        footer: "📖 My Recipe Book © 2024",

        // Navigation & Header
        addRecipeTab: "Add Recipe",
        myRecipesTab: "My Recipes",
        upgrade: "Upgrade (80% OFF)",
        dailyMenu: "Daily Menu",
        calculator: "Calculator",
        dashboard: "Dashboard",
        logout: "Logout",
        editProfile: "Edit Profile",
        premiumBadge: "💎 Premium",

        // Auth Page
        signIn: "Sign In",
        register: "Register",
        username: "Username",
        password: "Password",
        confirmPassword: "Confirm Password",
        email: "Email",
        emailAddress: "Email Address",
        phoneNumber: "Phone Number",
        birthday: "Birthday",
        rememberMe: "Remember Me",
        forgotPassword: "Forgot Password?",
        createAccount: "Create Account",
        dontHaveAccount: "Don't have an account?",
        alreadyHaveAccount: "Already have an account?",
        signInToAccess: "Sign in to access your delicious recipes",
        enterUsername: "Enter your username",
        enterPassword: "Enter your password",
        chooseUsername: "Choose a username",
        enterEmail: "Enter your email",
        createPassword: "Create a password",
        confirmYourPassword: "Confirm your password",

        // Reset Password
        resetPassword: "Reset Your Password",
        chooseRecoveryMethod: "Choose how you'd like to receive your verification code",
        sendOtpVia: "Send OTP via:",
        sendOtpToEmail: "Send OTP to Email",
        sendOtpToPhone: "Send OTP to Phone",
        enterVerificationCode: "Enter Verification Code",
        verificationCode: "Verification Code (OTP)",
        enterCode: "Enter 6-digit code",
        newPassword: "New Password",
        confirmNewPassword: "Confirm New Password",
        resendCode: "Resend Code",
        backToSignIn: "Back to Sign In",
        rememberedIt: "Remembered it?",
        rememberedPassword: "Remembered it?",
        otpSentMessage: "We sent a 6-digit code to your email",
        otpPlaceholder: "Enter 6-digit code",
        resetPasswordBtn: "Reset Password",

        // Additional auth keys
        authSubtitle: "Sign in to access your delicious recipes",
        signInBtn: "Sign In",
        noAccount: "Don't have an account?",
        registerLink: "Register",
        haveAccount: "Already have an account?",
        signInLink: "Sign In",
        usernamePlaceholder: "Enter your username",
        passwordPlaceholder: "Enter your password",
        chooseUsernamePlaceholder: "Choose a username",
        emailPlaceholder: "Enter your email",
        phonePlaceholder: "Phone number",
        createPasswordPlaceholder: "Create a password",
        confirmPasswordPlaceholder: "Confirm your password",
        searchCountry: "Search country...",
        phone: "Phone",
        registeredEmailPlaceholder: "Enter your registered email",
        registeredPhonePlaceholder: "Enter your registered phone number",
        newPasswordPlaceholder: "Enter new password",
        confirmNewPasswordPlaceholder: "Confirm new password",

        // Recipe Form
        recipePhoto: "Recipe Photo (Optional)",
        clickToUpload: "Click to upload photo",
        recipeName: "Recipe Name",
        recipeNamePlaceholder: "e.g., Chocolate Croissant",
        category: "Category",
        selectCategory: "Select a category",
        cakes: "🎂 Cakes",
        cookies: "🍪 Cookies",
        pastries: "🥐 Pastries",
        piesTarts: "🥧 Pies & Tarts",
        breads: "🍞 Breads",
        desserts: "🍰 Desserts",
        chocolates: "🍫 Chocolates",
        other: "✨ Other",
        prepTime: "Prep Time (min)",
        cookTime: "Cook Time (min)",
        servings: "Servings",
        difficulty: "Difficulty",
        easy: "🟢 Easy",
        medium: "🟡 Medium",
        hard: "🔴 Hard",
        ingredients: "Ingredients",
        ingredientsPlaceholder: "Enter each ingredient on a new line:\n2 cups all-purpose flour\n1 cup sugar\n1/2 cup butter\n2 eggs\n1 tsp vanilla extract",
        instructions: "Instructions",
        instructionsPlaceholder: "Enter step-by-step instructions:\n1. Preheat oven to 350°F\n2. Mix dry ingredients\n3. Add wet ingredients\n4. Pour into pan...",
        chefsNotes: "Chef's Notes (Optional)",
        notesPlaceholder: "Any tips, variations, or special notes...",
        clearForm: "Clear Form",
        addRecipeBtn: "Add Recipe",
        updateRecipe: "Update Recipe",

        // My Recipes
        searchRecipes: "Search recipes...",
        recipes: "Recipes",
        saveAsPdf: "Save as PDF",
        clearAll: "Clear All",
        emptyBookTitle: "Your recipe book is empty",
        emptyBookSubtitle: "Start adding your favorite recipes!",
        noRecipesFound: "No recipes found",
        view: "View",
        menu: "Menu",
        pdf: "PDF",
        edit: "Edit",
        delete: "Delete",
        min: "min",
        totalTime: "Total Time",

        // Edit Profile Modal
        profilePhoto: "Profile Photo",
        clickToUploadProfile: "Click to upload",
        displayName: "Display Name",
        newPasswordOptional: "New Password (leave blank to keep current)",
        saveChanges: "Save Changes",

        // Day Picker
        addToDailyMenu: "Add to Daily Menu",
        selectDayForRecipe: "Select a day for this recipe",
        saturday: "Saturday",
        sunday: "Sunday",
        monday: "Monday",
        tuesday: "Tuesday",
        wednesday: "Wednesday",
        thursday: "Thursday",
        friday: "Friday",

        // Premium Modal
        upgradeToPremium: "Upgrade to Premium",
        unlimitedRecipes: "Unlimited recipes in Daily Menu",
        planMeals: "Plan meals for the entire week",
        accessPremium: "Access all premium features",
        maybeLater: "Maybe Later",
        upgradeNow: "⭐ Upgrade Now",

        // Cost Calculator
        costCalculator: "Cost Calculator",
        costCalculatorSubtitle: "Calculate recipe costs and set profitable prices",
        recipeDetails: "Recipe Details",
        numberOfServings: "Number of Servings",
        ingredientCosts: "Ingredient Costs",
        ingredientName: "Ingredient Name",
        quantity: "Quantity",
        unit: "Unit",
        unitPrice: "Unit Price ($)",
        action: "Action",
        addIngredient: "Add Ingredient",
        additionalCosts: "Additional Costs",
        laborCost: "Labor Cost ($)",
        overheadCost: "Overhead Cost ($)",
        packagingCost: "Packaging Cost ($)",
        profitMargin: "Profit Margin",
        profitMarginPercent: "Profit Margin (%)",
        priceSummary: "Price Summary",
        totalCost: "Total Cost",
        profitAmount: "Profit Amount",
        sellingPrice: "Selling Price",
        costPerServing: "Cost per Serving",
        pricePerServing: "Price per Serving",
        profitPerServing: "Profit per Serving",
        saveCalculation: "Save Calculation",
        loadCalculation: "Load Calculation",
        clearCalculation: "Clear All",
        downloadPdf: "Download PDF",

        // Price Table
        priceTable: "Price Table",
        priceTableSubtitle: "Manage your ingredient prices",
        addNewPrice: "Add New Price",

        // Daily Menu
        dailyMenuTitle: "Daily Menu",
        dailyMenuSubtitle: "Plan your recipes for the week",
        selectDay: "Select a Day",
        addRecipeToMenu: "Add Recipe",
        noRecipesForDay: "No recipes for this day",

        // Payment
        choosePlan: "Choose Your Plan",
        monthlyPlan: "Monthly",
        yearlyPlan: "Yearly",
        perMonth: "/month",
        perYear: "/year",
        bestValue: "Best Value",
        subscribe: "Subscribe",
        paymentSuccess: "Payment Successful!",
        welcomePremium: "Welcome to Premium!",

        // Confirmations
        confirmLogout: "Are you sure you want to logout?",
        confirmDelete: "Are you sure you want to delete this recipe?",
        confirmClearAll: "Are you sure you want to delete ALL recipes? This cannot be undone!",
        yes: "Yes",
        no: "No",
        cancel: "Cancel",
        confirm: "Confirm",

        // Notifications
        recipeAdded: "Recipe saved to your collection! 🧁",
        recipeUpdated: "Recipe updated successfully! 🧁",
        recipeDeleted: "Recipe deleted successfully!",
        profileUpdated: "Profile updated successfully!",
        loginSuccess: "Welcome back!",
        registerSuccess: "Account created successfully!",
        storageFull: "Storage full! Image too large.",

        // Language
        language: "Language",
        english: "English",
        arabic: "العربية",

        // Admin Page
        adminDashboard: "Admin Dashboard",
        viewApp: "View App",
        totalUsers: "Total Users",
        admins: "Admins",
        totalRecipes: "Total Recipes",
        today: "Today",
        userManagement: "User Management",
        refresh: "Refresh",
        role: "Role",
        premium: "Premium",
        joined: "Joined",
        actions: "Actions",
        noUsersFound: "No users found",
        usersWillAppear: "Users will appear here once they register",
        quickActions: "Quick Actions",
        viewAllRecipes: "View All Recipes",
        browseAllRecipes: "Browse all user recipes",
        exportData: "Export Data",
        downloadAsJson: "Download all data as JSON",
        clearAllRecipes: "Clear All Recipes",
        removeAllRecipes: "Remove all stored recipes",
        systemInfo: "System Info",
        viewAppInfo: "View app information",
        areYouSure: "Are you sure?",
        actionCannotBeUndone: "This action cannot be undone.",
        editUser: "Edit User",
        newPasswordKeep: "New Password (leave blank to keep)",
        adminFooter: "👑 Admin Dashboard - My Recipe Book © 2024",

        // Days Selection & Daily Menu
        backToRecipes: "Back to Recipes",
        backToDays: "Back to Days",
        chooseADay: "Choose a Day",
        selectDayToView: "Select a day to view or add your recipes",
        dailyMenuFooter: "📅 Daily Menu - My Recipe Book © 2024",
        clickToAddCover: "Click to add a cover photo for this day",
        removePhoto: "Remove Photo",
        addRecipeBtn: "Add Recipe",
        noRecipesForDay: "No recipes for this day yet",
        clickAddRecipe: "Click the 'Add Recipe' button to add your first recipe!",
        addRecipeFor: "Add Recipe for",
        chooseFromSaved: "Choose from your saved recipes",
        selectFromMyRecipes: "Select from My Recipes",
        orCreateNew: "— or create a new recipe —",
        ingredientsOptional: "Ingredients (optional)",
        instructionsOptional: "Instructions (optional)",
        ingredientsPlaceholderShort: "e.g., 2 cups flour, 1 cup sugar, 3 eggs...",
        instructionsPlaceholderShort: "e.g., Step 1: Preheat oven to 350°F...",

        // Cost Calculator
        costCalculator: "Cost Calculator",
        calculateCostsSubtitle: "Calculate your recipe costs and selling prices",
        home: "Home",
        recipeItemName: "Recipe / Item Name",
        enterRecipeName: "Enter recipe name...",
        importFromRecipes: "Import from My Recipes",
        add: "Add",
        name: "Name",
        qty: "Qty",
        total: "Total",
        ingredientsSubtotal: "Ingredients Subtotal:",
        additionalCosts: "Additional Costs",
        laborCost: "👷 Labor Cost",
        overheadCost: "🏢 Overhead",
        packagingCost: "📦 Packaging",
        servingsLabel: "🍽️ Servings",
        results: "Results",
        profit: "Profit",
        sellingPricePerServing: "Selling Price per Serving:",
        reset: "Reset",
        savedCalculations: "Saved Calculations",

        // Payment Page
        backToApp: "Back to App",
        unlockFullPotential: "Unlock the full potential of your recipe collection",
        freePlan: "Free Plan",
        limitedFeatures: "Limited features",
        expires: "Expires:",
        greatForTrying: "Great for trying out",
        unlimitedRecipes: "Unlimited Recipes",
        pdfExport: "PDF Export",
        allCategories: "All Categories",
        multiplePhotos: "Multiple Photos",
        prioritySupport: "Priority Support",
        adFreeExperience: "Ad-Free Experience",
        subscribeMonthly: "Subscribe Monthly",
        mostPopular: "Most Popular",
        bestValueBakers: "Best value for bakers",
        save33: "Save 33%",
        cloudBackup: "Cloud Backup",
        subscribeYearly: "Subscribe Yearly",
        limitedOffer: "LIMITED OFFER",
        lifetimePlan: "Lifetime",
        oneTimePayment: "One-time payment",
        allPremiumFeatures: "All Premium Features",
        foreverAccess: "Forever Access",
        allFutureUpdates: "All Future Updates",
        founderBadge: "Founder Badge",
        getLifetimeAccess: "Get Lifetime Access - Only $20!",
        featureComparison: "Feature Comparison",
        securePayment: "Secure Payment",
        stripeProtected: "Stripe Protected",
        cancelAnytime: "Cancel Anytime",
        thirtyDayGuarantee: "30-Day Guarantee",
        faq: "Frequently Asked Questions",
        startUsingPremium: "Start Using Premium Features",
        paymentFooter: "📖 My Recipe Book © 2024 | Secure payments by Stripe",

        // Payment Success Page
        verifyingPayment: "Verifying your payment...",
        pleaseWaitConfirm: "Please wait while we confirm your subscription.",
        paymentSuccessful: "Payment Successful!",
        welcomeToPremium: "Welcome to Premium,",
        youNowHaveAccess: "You now have access to:",
        multiplePhotosPerRecipe: "Multiple Photos per Recipe"
    },

    ar: {
        // Common
        appTitle: "كتاب وصفاتي",
        appSubtitle: "أنشئ مجموعتك الشخصية من الوصفات اللذيذة",
        footer: "📖 كتاب وصفاتي © 2024",

        // Navigation & Header
        addRecipeTab: "إضافة وصفة",
        myRecipesTab: "وصفاتي",
        upgrade: "ترقية (خصم 80%)",
        dailyMenu: "القائمة اليومية",
        calculator: "الحاسبة",
        dashboard: "لوحة التحكم",
        logout: "تسجيل الخروج",
        editProfile: "تعديل الملف",
        premiumBadge: "💎 مميز",

        // Auth Page
        signIn: "تسجيل الدخول",
        register: "إنشاء حساب",
        username: "اسم المستخدم",
        password: "كلمة المرور",
        confirmPassword: "تأكيد كلمة المرور",
        email: "البريد الإلكتروني",
        emailAddress: "عنوان البريد الإلكتروني",
        phoneNumber: "رقم الهاتف",
        birthday: "تاريخ الميلاد",
        rememberMe: "تذكرني",
        forgotPassword: "نسيت كلمة المرور؟",
        createAccount: "إنشاء حساب",
        dontHaveAccount: "ليس لديك حساب؟",
        alreadyHaveAccount: "لديك حساب بالفعل؟",
        signInToAccess: "سجّل الدخول للوصول إلى وصفاتك اللذيذة",
        enterUsername: "أدخل اسم المستخدم",
        enterPassword: "أدخل كلمة المرور",
        chooseUsername: "اختر اسم مستخدم",
        enterEmail: "أدخل بريدك الإلكتروني",
        createPassword: "أنشئ كلمة مرور",
        confirmYourPassword: "أكد كلمة المرور",

        // Reset Password
        resetPassword: "إعادة تعيين كلمة المرور",
        chooseRecoveryMethod: "اختر طريقة استلام رمز التحقق",
        sendOtpVia: "إرسال الرمز عبر:",
        sendOtpToEmail: "إرسال الرمز للبريد",
        sendOtpToPhone: "إرسال الرمز للهاتف",
        enterVerificationCode: "أدخل رمز التحقق",
        verificationCode: "رمز التحقق (OTP)",
        enterCode: "أدخل الرمز المكون من 6 أرقام",
        newPassword: "كلمة المرور الجديدة",
        confirmNewPassword: "تأكيد كلمة المرور الجديدة",
        resendCode: "إعادة إرسال الرمز",
        backToSignIn: "العودة لتسجيل الدخول",
        rememberedIt: "تذكرتها؟",
        rememberedPassword: "تذكرتها؟",
        otpSentMessage: "أرسلنا رمز مكون من 6 أرقام إلى بريدك الإلكتروني",
        otpPlaceholder: "أدخل الرمز المكون من 6 أرقام",
        resetPasswordBtn: "إعادة تعيين كلمة المرور",

        // Additional auth keys
        authSubtitle: "سجّل الدخول للوصول إلى وصفاتك اللذيذة",
        signInBtn: "تسجيل الدخول",
        noAccount: "ليس لديك حساب؟",
        registerLink: "إنشاء حساب",
        haveAccount: "لديك حساب بالفعل؟",
        signInLink: "تسجيل الدخول",
        usernamePlaceholder: "أدخل اسم المستخدم",
        passwordPlaceholder: "أدخل كلمة المرور",
        chooseUsernamePlaceholder: "اختر اسم مستخدم",
        emailPlaceholder: "أدخل بريدك الإلكتروني",
        phonePlaceholder: "رقم الهاتف",
        createPasswordPlaceholder: "أنشئ كلمة مرور",
        confirmPasswordPlaceholder: "أكد كلمة المرور",
        searchCountry: "ابحث عن دولة...",
        phone: "الهاتف",
        registeredEmailPlaceholder: "أدخل البريد الإلكتروني المسجل",
        registeredPhonePlaceholder: "أدخل رقم الهاتف المسجل",
        newPasswordPlaceholder: "أدخل كلمة المرور الجديدة",
        confirmNewPasswordPlaceholder: "أكد كلمة المرور الجديدة",

        // Recipe Form
        recipePhoto: "صورة الوصفة (اختياري)",
        clickToUpload: "انقر لرفع صورة",
        recipeName: "اسم الوصفة",
        recipeNamePlaceholder: "مثال: كرواسون شوكولاتة",
        category: "الفئة",
        selectCategory: "اختر فئة",
        cakes: "🎂 كيك",
        cookies: "🍪 كوكيز",
        pastries: "🥐 معجنات",
        piesTarts: "🥧 فطائر وتارت",
        breads: "🍞 خبز",
        desserts: "🍰 حلويات",
        chocolates: "🍫 شوكولاتة",
        other: "✨ أخرى",
        prepTime: "وقت التحضير (دقيقة)",
        cookTime: "وقت الطهي (دقيقة)",
        servings: "الحصص",
        difficulty: "الصعوبة",
        easy: "🟢 سهل",
        medium: "🟡 متوسط",
        hard: "🔴 صعب",
        ingredients: "المكونات",
        ingredientsPlaceholder: "أدخل كل مكون في سطر جديد:\n2 كوب دقيق\n1 كوب سكر\n½ كوب زبدة\n2 بيضة\n1 ملعقة صغيرة فانيليا",
        instructions: "التعليمات",
        instructionsPlaceholder: "أدخل الخطوات:\n1. سخن الفرن على 180°C\n2. اخلط المكونات الجافة\n3. أضف المكونات السائلة\n4. اسكب في القالب...",
        chefsNotes: "ملاحظات الشيف (اختياري)",
        notesPlaceholder: "أي نصائح أو تعديلات أو ملاحظات خاصة...",
        clearForm: "مسح النموذج",
        addRecipeBtn: "إضافة الوصفة",
        updateRecipe: "تحديث الوصفة",

        // My Recipes
        searchRecipes: "بحث في الوصفات...",
        recipes: "وصفات",
        saveAsPdf: "حفظ كـ PDF",
        clearAll: "مسح الكل",
        emptyBookTitle: "كتاب وصفاتك فارغ",
        emptyBookSubtitle: "ابدأ بإضافة وصفاتك المفضلة!",
        noRecipesFound: "لم يتم العثور على وصفات",
        view: "عرض",
        menu: "قائمة",
        pdf: "PDF",
        edit: "تعديل",
        delete: "حذف",
        min: "دقيقة",
        totalTime: "الوقت الكلي",

        // Edit Profile Modal
        profilePhoto: "صورة الملف الشخصي",
        clickToUploadProfile: "انقر للرفع",
        displayName: "الاسم المعروض",
        newPasswordOptional: "كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)",
        saveChanges: "حفظ التغييرات",

        // Day Picker
        addToDailyMenu: "إضافة للقائمة اليومية",
        selectDayForRecipe: "اختر يوماً لهذه الوصفة",
        saturday: "السبت",
        sunday: "الأحد",
        monday: "الاثنين",
        tuesday: "الثلاثاء",
        wednesday: "الأربعاء",
        thursday: "الخميس",
        friday: "الجمعة",

        // Premium Modal
        upgradeToPremium: "الترقية للمميز",
        unlimitedRecipes: "وصفات غير محدودة في القائمة اليومية",
        planMeals: "خطط وجباتك لأسبوع كامل",
        accessPremium: "الوصول لجميع المميزات الخاصة",
        maybeLater: "ربما لاحقاً",
        upgradeNow: "⭐ ترقية الآن",

        // Cost Calculator
        costCalculator: "حاسبة التكلفة",
        costCalculatorSubtitle: "احسب تكاليف الوصفة وحدد أسعار مربحة",
        recipeDetails: "تفاصيل الوصفة",
        numberOfServings: "عدد الحصص",
        ingredientCosts: "تكاليف المكونات",
        ingredientName: "اسم المكون",
        quantity: "الكمية",
        unit: "الوحدة",
        unitPrice: "سعر الوحدة ($)",
        action: "إجراء",
        addIngredient: "إضافة مكون",
        additionalCosts: "التكاليف الإضافية",
        laborCost: "تكلفة العمل ($)",
        overheadCost: "التكاليف العامة ($)",
        packagingCost: "تكلفة التغليف ($)",
        profitMargin: "هامش الربح",
        profitMarginPercent: "هامش الربح (%)",
        priceSummary: "ملخص السعر",
        totalCost: "التكلفة الإجمالية",
        profitAmount: "مبلغ الربح",
        sellingPrice: "سعر البيع",
        costPerServing: "التكلفة لكل حصة",
        pricePerServing: "السعر لكل حصة",
        profitPerServing: "الربح لكل حصة",
        saveCalculation: "حفظ الحساب",
        loadCalculation: "تحميل حساب",
        clearCalculation: "مسح الكل",
        downloadPdf: "تحميل PDF",

        // Price Table
        priceTable: "جدول الأسعار",
        priceTableSubtitle: "إدارة أسعار المكونات",
        addNewPrice: "إضافة سعر جديد",

        // Daily Menu
        dailyMenuTitle: "القائمة اليومية",
        dailyMenuSubtitle: "خطط وصفاتك للأسبوع",
        selectDay: "اختر يوماً",
        addRecipeToMenu: "إضافة وصفة",
        noRecipesForDay: "لا توجد وصفات لهذا اليوم",

        // Payment
        choosePlan: "اختر خطتك",
        monthlyPlan: "شهري",
        yearlyPlan: "سنوي",
        perMonth: "/شهر",
        perYear: "/سنة",
        bestValue: "أفضل قيمة",
        subscribe: "اشتراك",
        paymentSuccess: "تم الدفع بنجاح!",
        welcomePremium: "مرحباً بك في المميز!",

        // Confirmations
        confirmLogout: "هل أنت متأكد من تسجيل الخروج؟",
        confirmDelete: "هل أنت متأكد من حذف هذه الوصفة؟",
        confirmClearAll: "هل أنت متأكد من حذف جميع الوصفات؟ لا يمكن التراجع عن هذا!",
        yes: "نعم",
        no: "لا",
        cancel: "إلغاء",
        confirm: "تأكيد",

        // Notifications
        recipeAdded: "تم حفظ الوصفة في مجموعتك! 🧁",
        recipeUpdated: "تم تحديث الوصفة بنجاح! 🧁",
        recipeDeleted: "تم حذف الوصفة بنجاح!",
        profileUpdated: "تم تحديث الملف الشخصي بنجاح!",
        loginSuccess: "مرحباً بعودتك!",
        registerSuccess: "تم إنشاء الحساب بنجاح!",
        storageFull: "المساحة ممتلئة! الصورة كبيرة جداً.",

        // Language
        language: "اللغة",
        english: "English",
        arabic: "العربية",

        // Admin Page
        adminDashboard: "لوحة تحكم المدير",
        viewApp: "عرض التطبيق",
        totalUsers: "إجمالي المستخدمين",
        admins: "المديرين",
        totalRecipes: "إجمالي الوصفات",
        today: "اليوم",
        userManagement: "إدارة المستخدمين",
        refresh: "تحديث",
        role: "الدور",
        premium: "مميز",
        joined: "تاريخ الانضمام",
        actions: "إجراءات",
        noUsersFound: "لم يتم العثور على مستخدمين",
        usersWillAppear: "سيظهر المستخدمون هنا بعد التسجيل",
        quickActions: "إجراءات سريعة",
        viewAllRecipes: "عرض جميع الوصفات",
        browseAllRecipes: "تصفح وصفات المستخدمين",
        exportData: "تصدير البيانات",
        downloadAsJson: "تحميل جميع البيانات كـ JSON",
        clearAllRecipes: "مسح جميع الوصفات",
        removeAllRecipes: "حذف جميع الوصفات المخزنة",
        systemInfo: "معلومات النظام",
        viewAppInfo: "عرض معلومات التطبيق",
        areYouSure: "هل أنت متأكد؟",
        actionCannotBeUndone: "لا يمكن التراجع عن هذا الإجراء.",
        editUser: "تعديل المستخدم",
        newPasswordKeep: "كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)",
        adminFooter: "👑 لوحة تحكم المدير - كتاب وصفاتي © 2024",

        // Days Selection & Daily Menu
        backToRecipes: "العودة للوصفات",
        backToDays: "العودة للأيام",
        chooseADay: "اختر يوماً",
        selectDayToView: "اختر يوماً لعرض أو إضافة وصفاتك",
        dailyMenuFooter: "📅 القائمة اليومية - كتاب وصفاتي © 2024",
        clickToAddCover: "انقر لإضافة صورة غلاف لهذا اليوم",
        removePhoto: "حذف الصورة",
        addRecipeBtn: "إضافة وصفة",
        noRecipesForDay: "لا توجد وصفات لهذا اليوم بعد",
        clickAddRecipe: "انقر على زر 'إضافة وصفة' لإضافة أول وصفة!",
        addRecipeFor: "إضافة وصفة لـ",
        chooseFromSaved: "اختر من وصفاتك المحفوظة",
        selectFromMyRecipes: "اختر من وصفاتي",
        orCreateNew: "— أو أنشئ وصفة جديدة —",
        ingredientsOptional: "المكونات (اختياري)",
        instructionsOptional: "التعليمات (اختياري)",
        ingredientsPlaceholderShort: "مثال: 2 كوب دقيق، 1 كوب سكر، 3 بيضات...",
        instructionsPlaceholderShort: "مثال: الخطوة 1: سخن الفرن على 180°C...",

        // Cost Calculator
        costCalculator: "حاسبة التكلفة",
        calculateCostsSubtitle: "احسب تكاليف وصفتك وأسعار البيع",
        home: "الرئيسية",
        recipeItemName: "اسم الوصفة / المنتج",
        enterRecipeName: "أدخل اسم الوصفة...",
        importFromRecipes: "استيراد من وصفاتي",
        add: "إضافة",
        name: "الاسم",
        qty: "الكمية",
        total: "الإجمالي",
        ingredientsSubtotal: "إجمالي المكونات:",
        additionalCosts: "التكاليف الإضافية",
        laborCost: "👷 تكلفة العمل",
        overheadCost: "🏢 التكاليف العامة",
        packagingCost: "📦 تكلفة التغليف",
        servingsLabel: "🍽️ الحصص",
        results: "النتائج",
        profit: "الربح",
        sellingPricePerServing: "سعر البيع لكل حصة:",
        reset: "إعادة ضبط",
        savedCalculations: "الحسابات المحفوظة",

        // Payment Page
        backToApp: "العودة للتطبيق",
        unlockFullPotential: "أطلق العنان لإمكانات مجموعة وصفاتك الكاملة",
        freePlan: "الخطة المجانية",
        limitedFeatures: "ميزات محدودة",
        expires: "ينتهي:",
        greatForTrying: "رائع للتجربة",
        unlimitedRecipes: "وصفات غير محدودة",
        pdfExport: "تصدير PDF",
        allCategories: "جميع الفئات",
        multiplePhotos: "صور متعددة",
        prioritySupport: "دعم مميز",
        adFreeExperience: "تجربة بدون إعلانات",
        subscribeMonthly: "اشترك شهرياً",
        mostPopular: "الأكثر شعبية",
        bestValueBakers: "أفضل قيمة للخبازين",
        save33: "وفر 33%",
        cloudBackup: "نسخ احتياطي سحابي",
        subscribeYearly: "اشترك سنوياً",
        limitedOffer: "عرض محدود",
        lifetimePlan: "مدى الحياة",
        oneTimePayment: "دفعة واحدة",
        allPremiumFeatures: "جميع المميزات المميزة",
        foreverAccess: "وصول دائم",
        allFutureUpdates: "جميع التحديثات المستقبلية",
        founderBadge: "شارة المؤسس",
        getLifetimeAccess: "احصل على وصول مدى الحياة - فقط $20!",
        featureComparison: "مقارنة الميزات",
        securePayment: "دفع آمن",
        stripeProtected: "محمي بواسطة Stripe",
        cancelAnytime: "إلغاء في أي وقت",
        thirtyDayGuarantee: "ضمان 30 يوم",
        faq: "الأسئلة الشائعة",
        startUsingPremium: "ابدأ استخدام المميزات المميزة",
        paymentFooter: "📖 كتاب وصفاتي © 2024 | دفع آمن عبر Stripe",

        // Payment Success Page
        verifyingPayment: "جارِ التحقق من الدفع...",
        pleaseWaitConfirm: "يرجى الانتظار بينما نؤكد اشتراكك.",
        paymentSuccessful: "تم الدفع بنجاح!",
        welcomeToPremium: "مرحباً بك في المميز،",
        youNowHaveAccess: "أصبح لديك وصول إلى:",
        multiplePhotosPerRecipe: "صور متعددة لكل وصفة"
    }
};

// Get current language
function getCurrentLanguage() {
    return localStorage.getItem('appLanguage') || 'en';
}

// Set language
function setLanguage(lang) {
    localStorage.setItem('appLanguage', lang);
    applyLanguage(lang);
}

// Toggle between languages
function toggleLanguage() {
    const current = getCurrentLanguage();
    const newLang = current === 'en' ? 'ar' : 'en';
    setLanguage(newLang);
}

// Get translation
function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang][key] || translations['en'][key] || key;
}

// Apply language to page
function applyLanguage(lang) {
    const isArabic = lang === 'ar';

    // Set HTML direction and lang attribute
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.toggle('rtl', isArabic);
    document.body.classList.toggle('ltr', !isArabic);

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);

        // Check if it's an input placeholder
        if (el.hasAttribute('data-i18n-placeholder')) {
            el.placeholder = translation;
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            // For input/textarea with data-i18n, update placeholder
            el.placeholder = translation;
        } else {
            // For regular elements, update text content
            // Preserve any icons/emojis at the start
            const hasIcon = el.querySelector('.btn-icon, .tab-icon');
            if (hasIcon) {
                // Keep the icon span, update only text
                const spans = el.querySelectorAll('span');
                if (spans.length > 1) {
                    spans[spans.length - 1].textContent = translation;
                } else if (spans.length === 1 && !spans[0].classList.contains('btn-icon') && !spans[0].classList.contains('tab-icon')) {
                    spans[0].textContent = translation;
                } else {
                    // Find text node and update
                    for (let node of el.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                            node.textContent = ' ' + translation;
                            break;
                        }
                    }
                }
            } else {
                el.textContent = translation;
            }
        }
    });

    // Update language toggle button
    const langToggle = document.getElementById('languageToggle');
    if (langToggle) {
        const langText = langToggle.querySelector('.lang-text');
        if (langText) {
            langText.textContent = isArabic ? 'EN' : 'عربي';
        }
    }

    // Dispatch event for custom handling
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

// Create language toggle button
function createLanguageToggle() {
    // Check if toggle already exists
    if (document.getElementById('languageToggle')) return;

    const toggle = document.createElement('button');
    toggle.id = 'languageToggle';
    toggle.className = 'language-toggle';
    toggle.setAttribute('aria-label', 'Toggle Language');

    const isArabic = getCurrentLanguage() === 'ar';
    toggle.innerHTML = `
        <span class="lang-icon">🌐</span>
        <span class="lang-text">${isArabic ? 'EN' : 'عربي'}</span>
    `;

    toggle.addEventListener('click', toggleLanguage);

    document.body.appendChild(toggle);
}

// Initialize language system
function initLanguage() {
    const lang = getCurrentLanguage();
    applyLanguage(lang);
    createLanguageToggle();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguage);
} else {
    initLanguage();
}

// Export functions for use in other modules
export {
    translations,
    getCurrentLanguage,
    setLanguage,
    toggleLanguage,
    t,
    applyLanguage,
    initLanguage,
    createLanguageToggle
};
