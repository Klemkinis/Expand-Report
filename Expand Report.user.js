// ==UserScript==
// @name         Expand Report
// @version      0.2.9
// @match        https://animemusicquiz.com/*
// @resource     malIds https://raw.githubusercontent.com/Kikimanox/DiscordBotNew/master/data/_amq/annMal.json
// @updateURL    https://github.com/Klemkinis/Expand-Report/raw/main/Expand%20Report.user.js
// @grant        GM_getResourceText
// ==/UserScript==

var genres = []
var tags = []
var malIds = JSON.parse(GM_getResourceText("malIds"))
var seasonIds = {
    "WINTER": 0,
    "SPRING": 1,
    "SUMMER": 2,
    "FALL": 3
}

setupHostModalSwizzling()
setupExpandLibrarySwizzling()

// Setup
function setupHostModalSwizzling() {
    if (typeof hostModal === 'undefined') {
        setTimeout(setupHostModalSwizzling, 1000)
        return
    }

    HostModal.prototype.super_setup = HostModal.prototype.setup
    HostModal.prototype.setup = setupHostModal
}

function setupHostModal(genreInfo, tagInfo, savedSettings, latestQuizSettingStrings) {
    this.super_setup(genreInfo, tagInfo, savedSettings, latestQuizSettingStrings)

    genres = genreInfo
    tags = tagInfo
}

function setupExpandLibrarySwizzling() {
    var expandLibrary = document.getElementById("expandLibraryPage")
    if (expandLibrary == null) {
        setTimeout(setupExpandLibrarySwizzling, 1000)
        return
    }

    ExpandLibrary.prototype.super_songOpened = ExpandLibrary.prototype.songOpened
    ExpandLibrary.prototype.songOpened = songOpened
}

function songOpened(songEntry) {
    this.super_songOpened(songEntry)
    if (reportButton() != null) {
        resetReportButton()
    } else {
        addReportButton()
    }
}

// Report Button
function reportButton() {
    return document.getElementById("reportButton")
}

function addReportButton() {
    var reportButton = document.createElement("div")
    var configuration = activeReportButtonConfiguration()
    configureReportButton(reportButton, configuration)

    var reportButtonContainer = document.getElementById("elInputQuestionContainer")
    if (reportButtonContainer == null) {
        return
    }
    reportButtonContainer.append(reportButton)
}

function displayReportProgressIndicator() {
    var button = reportButton()
    var configuration = loadingReportButtonConfiguration()
    configureReportButton(button, configuration)
}

function disableReportButton() {
    var button = reportButton()
    var configuration = disabledReportButtonConfiguration()
    configureReportButton(button, configuration)
}

function resetReportButton() {
    var button = reportButton()
    var configuration = activeReportButtonConfiguration()
    configureReportButton(button, configuration)
}

function configureReportButton(button, configuration) {
    if (button == null || configuration == null) {
        return
    }
    button.id = configuration.id
    button.className = configuration.className
    button.style.color = configuration.color
    button.style.fontSize = configuration.fontSize
    button.style.position = configuration.position
    button.style.bottom = configuration.bottomPadding
    button.style.right = configuration.rightPadding
    button.style.cursor = configuration.cursorType
    button.onclick = configuration.action
}

function activeReportButtonConfiguration() {
    var configuration = {}
    configuration.id = "reportButton"
    configuration.className = "fa fa-flag"
    configuration.color = "#ff4600"
    configuration.fontSize = "20px"
    configuration.position = "absolute"
    configuration.bottomPadding = "10px"
    configuration.rightPadding = "15px"
    configuration.cursorType = "pointer"
    configuration.action = function() {
        loadAnimeDetailsFromAnilist(expandLibrary.selectedSong)
    }
    return configuration
}

function disabledReportButtonConfiguration() {
    var configuration = activeReportButtonConfiguration()
    configuration.className = "fa fa-times"
    configuration.color = "#ff4600"
    configuration.action = null
    return configuration
}

function loadingReportButtonConfiguration() {
    var configuration = activeReportButtonConfiguration()
    configuration.className = "fa fa-spinner fa-pulse"
    configuration.color = "#4299f1"
    configuration.action = null
    return configuration
}

// Anilist
async function loadAnimeDetailsFromAnilist(song) {
    var url = "https://graphql.anilist.co"
    var httpMethod = "POST"
    var requestBody = animeDetailsRequestBody(song)
    try {
        displayReportProgressIndicator()
        var response = await responseFrom(url, httpMethod, requestBody)
        var animeDetails = parseAnimeDetailsFrom(response)
        resetReportButton()
        makeLobby(song, animeDetails)
    } catch (error) {
        disableReportButton()
        console.log(error)
    }
}

function responseFrom(url, method, body) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest()
        request.open(method, url, true)
        request.setRequestHeader("Content-Type", "application/json")
        request.setRequestHeader("Accept", "application/json")
        request.timeout = 15 * 1000
        request.onload = function() {
            if (this.status != 200) {
                reject("Request completed with error status: " + this.status + " " + this.statusText)
                return
            }
            resolve(this.response)
        }
        request.ontimeout = function() {
            reject("Request timedout!")
        }
        request.onerror = function() {
            reject("Unexpected network error!")
        }
        request.send(body)
    })
}

function animeDetailsRequestBody(song) {
    var malId = malIds[song.animeId]
    var title = song.animeName
    if (malId != null) {
        return animeDetailsByIdRequestBody(malId)
    } else {
        return animeDetailsByTitleRequestBody(title)
    }
}

function animeDetailsByIdRequestBody(malId) {
    var query = searchByIdQuery()
    var variables = { id: malId.split(" ")[0] }
    return JSON.stringify({
        query: query,
        variables: variables
    })
}

function animeDetailsByTitleRequestBody(title) {
    var query = searchByTitleQuery()
    var variables = { title: title }
    return JSON.stringify({
        query: query,
        variables: variables
    })
}

function searchByIdQuery() {
        return `
query ($id: Int) {
  Media (idMal: $id, type: ANIME) {
    seasonYear
    season
    genres
    tags {
      name
      rank
    }
  }
}
`
}

function searchByTitleQuery() {
    return `
query ($title: String) {
  Media (search: $title, type: ANIME) {
    seasonYear
    season
    genres
    tags {
      name
      rank
    }
  }
}
`
}

function parseAnimeDetailsFrom(response) {
    var animeDetails = JSON.parse(response).data.Media
    if (animeDetails == null) {
        throw("Invalid or corrupted response from anilist")
    }
    return animeDetails
}

// Lobby
function makeLobby(song, animeDetails) {
    hostModal.displayHostSolo()

    setSeasonSettings(animeDetails.seasonYear, animeDetails.season)
    setGenreSettings(animeDetails.genres)
    setTagSettings(animeDetails.tags)
    setMaxSongCountSetting(100)
    setOnlyWatchedSetting()
    setSelectedSongType(song.type)
    setGuessTimeSetting(5)

    roomBrowser.host()
}

function setSeasonSettings(year, season) {
    var seasonId = seasonIds[season]
    var seasonSettings = {
        standardValue: {
            years: [year, year],
            seasons: [seasonId, seasonId]
        },
        advancedValueList: []
    }

    hostModal.updateSetting("vintage", seasonSettings)
}

function setGenreSettings(selectedSongGenres) {
    if (genres.length == 0) {
        console.error("Missing AMQ genres - most likely something went wrong during login. Reload page for full functionality")
        return
    }

    var genreSettings = selectedSongGenres
    .map(selectedSongGenre => {
        var amqGenre = genres.find(genre => genre.name == selectedSongGenre)
        if (amqGenre == null) {
            return null
        }
        return {id: amqGenre.id, state: 1}
    })
    .filter(genre => genre != null)

    hostModal.updateSetting("genre", genreSettings)
}

function setTagSettings(selectedSongTags) {
    if (tags.length == 0) {
        console.error("Missing AMQ tags - most likely something went wrong during login. Reload page for full functionality")
        return
    }

    var tagSettings = selectedSongTags
    .filter(tag => tag.rank > 50)
    .map(selectedSongTag => {
        var amqTag = tags.find(tag => tag.name == selectedSongTag.name)
        if (amqTag == null) {
            return null
        }
        return {id: amqTag.id, state: 1}
    })
    .filter(tag => tag != null)

    hostModal.updateSetting("tags", tagSettings)
}

function setOnlyWatchedSetting() {
    var songSelectionSettings = {
        standardValue: 3,
        advancedValue: {
            watched: 100,
            unwatched: 0,
            random: 0
        }
    }
    hostModal.updateSetting("songSelection", songSelectionSettings)
}

function setMaxSongCountSetting(count) {
    hostModal.updateSetting("numberOfSongs", count)
}

function setSelectedSongType(type) {
    var songTypeSettings = {
        standardValue: {
            openings: type == 1,
            endings: type == 2,
            inserts: type == 3
        },
        advancedValue: {
            openings: 0,
            endings: 0,
            inserts: 0,
            random: 100
        }
    }
    hostModal.updateSetting("songType", songTypeSettings)
}

function setGuessTimeSetting(time) {
    var guessTimeSettings = {
        standardValue: time,
        randomValue: [time, time],
        randomOn: false
    }
    hostModal.updateSetting("guessTime", guessTimeSettings)
}
