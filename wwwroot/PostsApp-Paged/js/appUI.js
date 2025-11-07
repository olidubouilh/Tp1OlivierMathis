const periodicRefreshPeriod = 10;
let categories = [];
let selectedCategory = "";
let pageManager;
let itemLayout;

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
    $('#categoriesMenu').show()
    posts_API.resume_Periodic_Refresh();
}
function hideposts() {
    $("#scrollPanel").hide();
    $("#createpost").hide();
    $('#categoriesMenu').hide();
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
    queryString += "&sort=category,title";
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    addWaitingGif();
    compileCategories();
    let response = await posts_API.Get(queryString);
    if (!posts_API.error) {
        let posts = response.data;
        if (posts.length > 0) {
            posts.forEach(post => {
                container.append(renderpost(post));
            });
            $(".editCmd").off();
            $(".editCmd").on("click", function () {
                renderEditpostForm($(this).attr("editpostId"));
            });
            $(".deleteCmd").off();
            $(".deleteCmd").on("click", function () {
                renderDeletepostForm($(this).attr("deletepostId"));
            });
        } else
            endOfData = true;
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
        let favicon = makeFavicon(post.Url);
        if (post !== null) {
            $("#postForm").append(`
            <div class="postdeleteForm">
                <h4>Effacer le favori suivant?</h4>
                <br>
                <div class="postRow" id=${post.Id}">
                    <div class="postContainer noselect">
                        <div class="postLayout">
                            <div class="post">
                                <a href="${post.Url}" target="_blank"> ${favicon} </a>
                                <span class="postTitle">${post.Title}</span>
                            </div>
                            <span class="postCategory">${post.Category}</span>
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
    post.Url = "";
    post.Category = "";
    return post;
}
function renderpostForm(post = null) {
    hideposts();
    let create = post == null;
    let favicon = `<div class="big-favicon"></div>`;
    if (create)
        post = newpost();
    else
        favicon = makeFavicon(post.Url, true);
    $("#actionTitle").text(create ? "Création" : "Modification");
    $("#postForm").show();
    $("#postForm").empty();
    $("#postForm").append(`
        <form class="form" id="postForm">
            <a href="${post.Url}" target="_blank" id="faviconLink" class="big-favicon" > ${favicon} </a>
            <br>
            <input type="hidden" name="Id" value="${post.Id}"/>

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
            <label for="Url" class="form-label">Url </label>
            <input
                class="form-control URL"
                name="Url"
                id="Url"
                placeholder="Url"
                required
                value="${post.Url}" 
            />
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <br>
            <input type="submit" value="Enregistrer" id="savepost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
    initFormValidation();
    $("#Url").on("change", function () {
        let favicon = makeFavicon($("#Url").val(), true);
        $("#faviconLink").empty();
        $("#faviconLink").attr("href", $("#Url").val());
        $("#faviconLink").append(favicon);
    })
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        post = await posts_API.Save(post, create);
        if (!posts_API.error) {
            showposts();
            await pageManager.update();
            compileCategories();
            pageManager.scrollToElem(post.Id);
        }
        else
            renderError("Une erreur est survenue!");
    });
    $('#cancel').on("click", function () {
        showposts();
    });
}
function makeFavicon(url, big = false) {
    // Utiliser l'API de google pour extraire le favicon du site pointé par url
    // retourne un élément div comportant le favicon en tant qu'image de fond
    ///////////////////////////////////////////////////////////////////////////
    /*if (url.slice(-1) != "/") url += "/";*/
    let faviconClass = "favicon";
    if (big) faviconClass = "big-favicon";
    url = "http://www.google.com/s2/favicons?sz=64&domain=" + url;5
    return `<div class="${faviconClass}" style="background-image: url('${url}');"></div>`;
}
function renderpost(post) {
    let favicon = makeFavicon(post.Url);
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
