// ==UserScript==
// @name         Expand Report
// @version      0.1
// @match        https://animemusicquiz.com/*
// ==/UserScript==

var genres
var tags
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

function setupHostModal(genreInfo, tagInfo, savedSettings) {
    this.super_setup(genreInfo, tagInfo, savedSettings)

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
    reportButton.id = "reportButton"
    reportButton.className = "fa fa-flag"
    reportButton.style.color = "#ff4600"
    reportButton.style.fontSize = "20px"
    reportButton.style.position = "absolute"
    reportButton.style.bottom = "10px"
    reportButton.style.right = "15px"
    reportButton.style.cursor = "pointer"
    reportButton.onclick = function() {
        loadAnimeDetailsFromAnilist(expandLibrary.selectedSong)
    }

    var reportButtonContainer = document.getElementById("elInputQuestionContainer")
    if (reportButtonContainer == null) {
        return
    }
    reportButtonContainer.append(reportButton)
}

function displayReportProgressIndicator() {
    var button = reportButton()
    if (button == null) {
        return
    }
    button.className = "fa fa-spinner fa-pulse"
    button.style.color = "#4299f1"
    button.onclick = null
}

function disableReportButton() {
    var button = reportButton()
    if (button == null) {
        return
    }
    button.className = "fa fa-times"
    button.style.color = "#ff4600"
    button.onclick = null
}

function resetReportButton() {
    var button = reportButton()
    if (button == null) {
        return
    }
    button.className = "fa fa-flag"
    button.style.color = "#ff4600"
    button.onclick = function() {
        loadAnimeDetailsFromAnilist(expandLibrary.selectedSong)
    }
}

// Anilist
function loadAnimeDetailsFromAnilist(song) {
    var query = `
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
    var variables = {
        title: song.animeName
    }

    var url = "https://graphql.anilist.co"
    var request = new XMLHttpRequest()
    request.open("POST", url, true)
    request.setRequestHeader("Content-Type", "application/json")
    request.setRequestHeader("Accept", "application/json")
    request.onreadystatechange = function() {
        if (this.readyState != 4 || this.status != 200) {
            return
        }
        parseAnilistResponse(this.response, song)
    }
    let requestBody = JSON.stringify({
        query: query,
        variables: variables
    })

    displayReportProgressIndicator()
    request.send(requestBody)
}

function parseAnilistResponse(response, song) {
    var animeDetails = JSON.parse(response).data.Media
    if (animeDetails == null) {
        disableReportButton()
        return
    }

    resetReportButton()
    makeLobby(song, animeDetails)
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
            openings: type == 1 ? 100 : 0,
            endings: type == 2 ? 100 : 0,
            inserts: type == 3 ? 100 : 0,
            random: 0
        }
    }
    hostModal.updateSetting("songType", songTypeSettings)
}