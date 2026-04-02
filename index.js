require('dotenv').config();

// === SERVEUR POUR RENDER (IMPORTANT) ===
const http = require('http');

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Discord actif');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur actif sur le port ${PORT}`);
});

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  CATEGORY_ID,
  AVOCAT_ROLE_ID,
  JUGE_ROLE_ID,
  PRESIDENCE_ROLE_ID
} = process.env;

/* =========================================================
   CONFIG
========================================================= */

const CONFIG = {
  panel: {
    title: 'TRIBUNAL DE LA RÉPUBLIQUE',
    subtitle: 'Portail officiel de traitement des requêtes',
    description:
      'Le présent portail permet la transmission des demandes vers le service compétent.\n' +
      'Chaque dossier est ouvert dans un canal privé, confidentiel et sécurisé.\n\n' +
      'Nous vous invitons à sélectionner le service correspondant à votre situation.',
    footer:
      'République Française • Portail officiel • Merci de formuler des demandes claires et sérieuses',
    color: 0x243b53,
    bannerImage: 'https://cdn.discordapp.com/attachments/1421846851476521050/1489337251363291178/Logo.rp.png?ex=69d00ce7&is=69cebb67&hm=bfb0e671308bf84afd1b4f01943120bd2cb3badd295d337664838613e9a06e29&'
  },

  tickets: {
    categoryId: CATEGORY_ID,
    closeMessage: '🔒 Ce dossier sera clôturé dans 5 secondes.',
    alreadyOpenMessage: 'Un dossier est déjà ouvert pour ce service : {channel}',
    creatingMessage: '⏳ Ouverture du dossier en cours...',
    createdMessage: '✅ Votre dossier a été ouvert : {channel}',
    errorMessage: '❌ Une erreur est survenue lors du traitement de votre demande.',
    waitingMessage:
      'Votre demande sera examinée par le service compétent dans les meilleurs délais.'
  },

  services: {
    avocat: {
      customId: 'ticket_avocat',
      roleId: AVOCAT_ROLE_ID,
      channelName: 'avocat',
      buttonLabel: 'Avocats',
      buttonEmoji: '⚖️',
      buttonStyle: ButtonStyle.Primary,
      panelBlock:
        '⚖️ **AVOCATS**\n' +
        '> Assistance juridique, défense, conseil et accompagnement des dossiers.',
      openTitle: 'Ouverture d’un dossier — Avocats',
      openDescription:
        'Bonjour {user},\n\n' +
        'Votre demande a été transmise au service des avocats.\n\n' +
        'Merci de détailler votre situation avec clarté, précision et sérieux afin de permettre son instruction.'
    },

    juge: {
      customId: 'ticket_juge',
      roleId: JUGE_ROLE_ID,
      channelName: 'juge',
      buttonLabel: 'Juges',
      buttonEmoji: '👨‍⚖️',
      buttonStyle: ButtonStyle.Success,
      panelBlock:
        '👨‍⚖️ **JUGES**\n' +
        '> Examen des affaires, suivi des procédures et traitement des décisions judiciaires.',
      openTitle: 'Ouverture d’un dossier — Juges',
      openDescription:
        'Bonjour {user},\n\n' +
        'Votre demande a été transmise au service des juges.\n\n' +
        'Nous vous invitons à préciser l’objet exact de votre requête afin d’en faciliter l’examen.'
    },

    presidence: {
      customId: 'ticket_presidence',
      roleId: PRESIDENCE_ROLE_ID,
      channelName: 'presidence',
      buttonLabel: 'Présidence',
      buttonEmoji: '🏛️',
      buttonStyle: ButtonStyle.Danger,
      panelBlock:
        '🏛️ **PRÉSIDENCE**\n' +
        '> Requêtes institutionnelles, arbitrages et dossiers relevant de l’autorité supérieure.',
      openTitle: 'Ouverture d’un dossier — Présidence',
      openDescription:
        'Bonjour {user},\n\n' +
        'Votre demande a été transmise à la présidence.\n\n' +
        'Merci de formuler une requête complète, motivée et sérieuse pour permettre son examen.'
    }
  }
};

/* =========================================================
   OUTILS
========================================================= */

const locks = new Set();

function formatText(text, data = {}) {
  return text
    .replaceAll('{user}', data.user || '')
    .replaceAll('{channel}', data.channel || '')
    .replaceAll('{dossier}', data.dossier || '');
}

function getServiceByCustomId(customId) {
  return Object.values(CONFIG.services).find(
    service => service.customId === customId
  ) || null;
}

function generateCaseNumber() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `TR-${year}${month}${day}-${randomPart}`;
}

function buildPanelEmbed() {
  const serviceBlocks = Object.values(CONFIG.services)
    .map(service => service.panelBlock)
    .join('\n\n────────────────────────────\n\n');

  return new EmbedBuilder()
    .setColor(CONFIG.panel.color)
    .setTitle(' ')
    .setImage(CONFIG.panel.bannerImage)
    .setDescription(
      [
        '# ' + CONFIG.panel.title,
        '',
        '### ' + CONFIG.panel.subtitle,
        '',
        '────────────────────────────',
        '',
        CONFIG.panel.description,
        '',
        '────────────────────────────',
        '',
        serviceBlocks,
        '',
        '────────────────────────────',
        '',
        '### Veuillez sélectionner le service concerné'
      ].join('\n')
    )
    .setFooter({ text: CONFIG.panel.footer })
    .setTimestamp();
}

function buildPanelButtons() {
  return new ActionRowBuilder().addComponents(
    ...Object.values(CONFIG.services).map(service =>
      new ButtonBuilder()
        .setCustomId(service.customId)
        .setLabel(service.buttonLabel)
        .setEmoji(service.buttonEmoji)
        .setStyle(service.buttonStyle)
    )
  );
}

function buildTicketEmbed(service, user, caseNumber) {
  return new EmbedBuilder()
    .setColor(CONFIG.panel.color)
    .setTitle(service.openTitle)
    .setDescription(
      [
        `**Numéro de dossier :** \`${caseNumber}\``,
        '',
        formatText(service.openDescription, {
          user: `${user}`
        }),
        '',
        '────────────────────────────',
        '',
        CONFIG.tickets.waitingMessage
      ].join('\n')
    )
    .setFooter({
      text: `Référence dossier : ${caseNumber}`
    })
    .setTimestamp();
}

function buildCloseButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Clôturer le dossier')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary)
  );
}

/* =========================================================
   COMMANDES
========================================================= */

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Affiche le portail officiel des dossiers')
    .toJSON()
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log('Commande /panel enregistrée.');
}

/* =========================================================
   READY
========================================================= */

client.once('clientReady', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('Erreur enregistrement commande :', error);
  }
});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        await interaction.reply({
          embeds: [buildPanelEmbed()],
          components: [buildPanelButtons()]
        });
      }
      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply({
        content: CONFIG.tickets.closeMessage
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error('Erreur suppression ticket :', error);
        }
      }, 5000);

      return;
    }

    const service = getServiceByCustomId(interaction.customId);

    if (!service) {
      await interaction.reply({
        content: CONFIG.tickets.errorMessage,
        ephemeral: true
      });
      return;
    }

    const guild = interaction.guild;
    const channelName = `${service.channelName}-${interaction.user.id}`;
    const lockKey = `${guild.id}-${interaction.user.id}-${service.channelName}`;

    if (locks.has(lockKey)) {
      await interaction.reply({
        content: CONFIG.tickets.creatingMessage,
        ephemeral: true
      }).catch(() => {});
      return;
    }

    locks.add(lockKey);

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingChannel = guild.channels.cache.find(
        channel =>
          channel.parentId === CONFIG.tickets.categoryId &&
          channel.name === channelName
      );

      if (existingChannel) {
        await interaction.editReply({
          content: formatText(CONFIG.tickets.alreadyOpenMessage, {
            channel: `${existingChannel}`
          })
        });
        return;
      }

      const caseNumber = generateCaseNumber();

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CONFIG.tickets.categoryId,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: service.roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels
            ]
          }
        ]
      });

      await channel.send({
        content: `<@${interaction.user.id}> <@&${service.roleId}>`,
        embeds: [buildTicketEmbed(service, interaction.user, caseNumber)],
        components: [buildCloseButton()]
      });

      await interaction.editReply({
        content: formatText(CONFIG.tickets.createdMessage, {
          channel: `${channel}`
        })
      });
    } finally {
      setTimeout(() => {
        locks.delete(lockKey);
      }, 3000);
    }
  } catch (error) {
    console.error('Erreur interaction :', error);

    if (interaction.deferred) {
      await interaction.editReply({
        content: CONFIG.tickets.errorMessage
      }).catch(() => {});
    } else if (interaction.replied) {
      await interaction.followUp({
        content: CONFIG.tickets.errorMessage,
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: CONFIG.tickets.errorMessage,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);