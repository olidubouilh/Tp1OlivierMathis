const periodicRefreshPeriod = 10;
const minKeywordLength = 1;
let categories = [];
let selectedCategory = "";
let pageManager;
let itemLayout;
let searchKeys = "";
let showKeywords = true;
let waiting = null;
let waitingGifTrigger = 2000;

function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        $("#itemsPanel").append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

Init_UI();

async function Init_UI() {
    pageManager = new PageManager('scrollPanel', 'itemsPanel', 'sample', renderposts);

    $('#createpost').on("click", async function () {
        renderCreatepostForm();
    });
    $('#abort').on("click", async function () {
        showposts();
        deleteError();
    });
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#searchCmd').on("click", function () {
        showSearchBar();
    });
    $('#closeSearchCmd').on("click", function () {
        hideSearchBar();
    });
    let searchTimeout;
    $('#searchKeys').on("input", function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            eraseHighlights();
            await pageManager.reset();
        },500);
    });
    showposts();

    posts_API.start_Periodic_Refresh(async () => { await pageManager.update(); });
}
function showposts() {
    $("#actionTitle").text("Liste des nouvelles");
    $("#scrollPanel").show();
    $('#abort').hide();
    $('#postForm').hide();
    $('#aboutContainer').hide();
    $("#createpost").show();
    $('#searchCmd').show();
    $('#categoriesMenu').show();
    posts_API.resume_Periodic_Refresh();
}
function hideposts() {
    $("#scrollPanel").hide();
    $("#createpost").hide();
    $('#searchCmd').hide();
    $('#categoriesMenu').hide();
    $("#searchBar").hide();
    $("#abort").show();
    posts_API.stop_Periodic_Refresh();
}
function renderAbout() {
    hideposts();
    $("#actionTitle").text("À propos...");
    $("#aboutContainer").show();
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#allCatCmd').on("click", function () {
        showposts();
        selectedCategory = "";
        updateDropDownMenu();
        pageManager.reset();
    });
    $('.category').on("click", function () {
        showposts();
        selectedCategory = $(this).text().trim();
        updateDropDownMenu();
        pageManager.reset();
    });
}
async function compileCategories() {
    categories = [];
    let response = await posts_API.GetQuery("?select=category&sort=category");
    if (!posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            updateDropDownMenu();
        }
    }
}
async function renderposts(container, queryString) {
    deleteError();
    let endOfData = false;
    queryString += "&sort=-creation,title";
    if (selectedCategory != "")
        queryString += "&category=" + selectedCategory;
    
    addWaitingGif();
    compileCategories();

    searchKeys = $("#searchKeys").val().trim();
    
    let response = await posts_API.Get(queryString);
    if (!posts_API.error) {
        let posts = response.data;
        if (searchKeys !== "") {
            posts = filterPostsByKeywords(posts, searchKeys);
        }
        
        if (posts.length > 0) {
            posts.forEach(post => {
                container.append(renderpost(post));
            });
            
            if (searchKeys !== "") {
                highlightKeywords();
            }
            
            $(".editCmd").off();
            $(".editCmd").on("click", function () {
                renderEditpostForm($(this).attr("editpostId"));
            });
            $(".deleteCmd").off();
            $(".deleteCmd").on("click", function () {
                renderDeletepostForm($(this).attr("deletepostId"));
            });
        } else {
            endOfData = true;
            // Afficher un message si aucun résultat
            if (searchKeys !== "") {
                container.append($(`
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <i class="fa fa-search" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <p style="font-size: 1.2rem;">Aucun résultat trouvé pour "${searchKeys}"</p>
                    </div>
                `));
            }
        }
    } else {
        renderError(posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderError(message) {
    hideposts();
    $("#actionTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").append($(`<div>${message}</div>`));
}
function deleteError() {
    $("#errorContainer").empty();
}
function renderCreatepostForm() {
    renderpostForm();
}
async function renderEditpostForm(id) {
    addWaitingGif();
    let response = await posts_API.Get(id)
    if (!posts_API.error) {
        let post = response.data;
        if (post !== null)
            renderpostForm(post);
        else
            renderError("post introuvable!");
    } else {
        renderError(posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletepostForm(id) {
    hideposts();
    $("#actionTitle").text("Retrait");
    $('#postForm').show();
    $('#postForm').empty();
    let response = await posts_API.Get(id)
    if (!posts_API.error) {
        let post = response.data;
        let creationDate = convertToFrenchDate(post.Creation);
        
        if (post !== null) {
            $("#postForm").append(`
            <div class="postdeleteForm">
                <h4>Effacer le favori suivant?</h4>
                <br>
                <div class="postRow" id=${post.Id}">
                    <div class="postContainer noselect">
                        <div class="postLayout">
                            <div class="post">
                                <div class="postTitle">${post.Title}</div>
                                <span class="postCategory">${post.Category}</span>
                                <div style="font-size: 0.85rem; color: #666; margin-top: 8px;">
                                    Créé le: ${creationDate}
                                </div>
                            </div>
                        </div>
                     </div>
                </div>   
                <br>
                <input type="button" value="Effacer" id="deletepost" class="btn btn-primary">
                <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
            </div>    
            `);
            $('#deletepost').on("click", async function () {
                await posts_API.Delete(post.Id);
                if (!posts_API.error) {
                    showposts();
                    await pageManager.update();
                    compileCategories();
                }
                else {
                    console.log(posts_API.currentHttpError)
                    renderError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", function () {
                showposts();
            });

        } else {
            renderError("post introuvable!");
        }
    } else
        renderError(posts_API.currentHttpError);
}
function getFormData($form) {
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
function newpost() {
    post = {};
    post.Id = 0;
    post.Title = "";
    post.Text = "";
    post.Category = "";
    post.Image = "";
    post.Creation = Math.floor(Date.now() / 1000);
    return post;
}
function renderpostForm(post = null) {
    hideposts();
    let create = post == null;
    if (create)
        post = newpost();
    
    $("#actionTitle").text(create ? "Création" : "Modification");
    $("#postForm").show();
    $("#postForm").empty();
    $("#postForm").append(`
    <form class="form" id="postFormElement">
        
        <input type="hidden" name="Id" value="${post.Id}"/>
        <input type="hidden" name="Creation" value="${post.Creation || Date.now()}"/>

        <label for="Category" class="form-label">Categorie </label>
            <input 
                class="form-control Alpha"
                name="Category" 
                id="Category" 
                placeholder="Catégorie"
                required
                RequireMessage="Veuillez entrer une catégorie"
                InvalidMessage="La catégorie comporte un caractère illégal"
                value="${post.Category}"
            />

            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control Alpha"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />

            <label for="Text" class="form-label">Texte </label>
            <textarea
                class="form-control Text"
                name="Text"
                id="Text"
                placeholder="Text"
                required>${post.Text}</textarea>

            <!-- nécessite le fichier javascript 'imageControl.js' -->
            <label class="form-label">Image </label>
            <div class='imageUploader' 
                 newImage='${create}' 
                 controlId='Image' 
                 imageSrc='${post.Image}' 
                 waitingImage="Loading_icon.gif">
            </div>
            <hr>
            <input type="submit" value="Enregistrer" id="savepost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
    
    initImageUploaders();
    initFormValidation();
    
    $('#postFormElement').on("submit", async function (event) {
        event.preventDefault();
        let postData = getFormData($(this));
        
        addWaitingGif();
        let result = await posts_API.Save(postData, create);
        
        if (result) {
            showposts();
            await pageManager.update();
        } else {
            console.log("Erreur:", posts_API.currentHttpError);
            renderError("Une erreur est survenue! " + posts_API.currentHttpError);
        }
        removeWaitingGif();
    });
    
    $('#cancel').on("click", function () {
        showposts();
    });
}
function renderpost(post) {
    let creationDate = convertToFrenchDate(post.Creation);
    return $(`
     <div class="postRow" id='${post.Id}'>
        <div class="postContainer noselect">
            <div class="postLayout">
                <div class="post">
                    <div class="postCommandPanel">
                        <div>
                            <div class="postCategory">${post.Category}</div>
                        </div>
                        <div class="rightItems">
                            <span class="editCmd cmdIcon fa fa-pencil" editpostId="${post.Id}" title="Modifier ${post.Title}"></span>
                            <span class="deleteCmd cmdIcon fa fa-trash" deletepostId="${post.Id}" title="Effacer ${post.Title}"></span>
                        </div>
                    </div>
                    <div class="postTitle">${post.Title}</div>
                    <div class="imagePreview" style="background-image:url('${post.Image}')"></div>
                    <div class="postText hideExtra">${post.Text}</div>
                    <div class="postDate" style="font-size: 0.85rem; color: #666; margin-top: 8px; font-style: italic;">
                        ${creationDate}
                    </div>
                    <div class="toggleText" style="text-align:center">
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>           
    `);
}

$(document).on('click', '.toggleText', function() {
    let postRow = $(this).closest('.postRow');
    let textDiv = postRow.find('.postText');
    textDiv.toggleClass('hideExtra showExtra');
    let icon = $(this).find('i');
    icon.toggleClass('fa-chevron-down fa-chevron-up');
});
function convertToFrenchDate(numeric_date) {
    let timestamp = numeric_date < 10000000000 ? numeric_date * 1000 : numeric_date;
    let date = new Date(timestamp);
    var options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'America/New_York'
    };
    var opt_weekday = { 
        weekday: 'long',
        timeZone: 'America/New_York'
    };
    var timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/New_York',
        hour12: false
    };
    
    var weekday = toTitleCase(date.toLocaleDateString("fr-FR", opt_weekday));
    
    function toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
        );
    }
    
    return weekday + " le " + date.toLocaleDateString("fr-FR", options) + " à " + date.toLocaleTimeString("fr-FR", timeOptions);
}

function UTC_To_Local(UTC_numeric_date) {
    let UTC_Offset = new Date().getTimezoneOffset() / 60;
    let UTC_Date = new Date(UTC_numeric_date);
    UTC_Date.setHours(UTC_Date.getHours() - UTC_Offset);
    let Local_numeric_date = UTC_Date.getTime();
    return Local_numeric_date;
}

function Local_to_UTC(Local_numeric_date) {
    let UTC_Offset = new Date().getTimezoneOffset() / 60;
    let Local_Date = new Date(Local_numeric_date);
    Local_Date.setHours(Local_Date.getHours() + UTC_Offset);
    let UTC_numeric_date = Local_Date.getTime();
    return UTC_numeric_date;
}
function filterPostsByKeywords(posts, searchKeys) {
    let keywords = searchKeys.split(' ').filter(k => k.trim().length >= minKeywordLength);
    
    if (keywords.length === 0) return posts;
    
    return posts.filter(post => {
        let postText = (post.Title + " " + post.Text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        
        return keywords.every(keyword => {
            let normalizedKeyword = keyword
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return postText.includes(normalizedKeyword);
        });
    });
}

function highlight(text, elem) {
    text = text.trim().toLowerCase(); // Ajout de toLowerCase() ici
    if (text.length >= minKeywordLength) { // Correction du nom de la variable
        var innerHTML = elem.innerHTML;
        let startIndex = 0;
        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Correction de toLocaleLowerCase
            var normalizedText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Normaliser aussi le texte recherché
            var index = normalizedHtml.indexOf(normalizedText, startIndex); // Utiliser le texte normalisé
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else {
                startIndex = innerHTML.length + 1;
            }
        }
        elem.innerHTML = innerHTML;
    }
}

function highlightKeywords() {
    if (showKeywords && searchKeys !== "") { // Ajout de la vérification searchKeys
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                if (key.trim().length >= minKeywordLength) { // Vérifier la longueur minimale
                    let titles = document.getElementsByClassName('postTitle');
                    Array.from(titles).forEach(title => {
                        highlight(key, title);
                    });
                    let texts = document.getElementsByClassName('postText');
                    Array.from(texts).forEach(text => {
                        highlight(key, text);
                    });
                }
            });
        }
    }
}
function eraseHighlights() {
    $('.postTitle, .postText').each(function() {
        let html = $(this).html();
        // Remplacer tous les spans de highlight par leur contenu texte
        html = html.replace(/<span class=['"]highlight['"]>(.*?)<\/span>/gi, '$1');
        $(this).html(html);
    });
}
function showSearchBar() {
    $("#searchBar").slideDown(300);
    $("#searchKeys").focus();
}

function hideSearchBar() {
    $("#searchBar").slideUp(300);
    $("#searchKeys").val("");
    pageManager.reset();
    posts_API.resume_Periodic_Refresh();
}
