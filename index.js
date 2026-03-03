import { createSpinner } from './utils/errorHandler.js';
import prompts from "prompts";
import { getGuilds, enhanceGuildData } from "./utils/getGuilds.js";
import { getRelationships } from "./utils/getRelationships.js";
import { checkToken } from "./utils/checkToken.js";
import { validateToken, validate2FACode } from './utils/validation.js';
import { discordFetch } from './utils/rateLimiter.js';
import { CONFIG } from './config.js';

const formatDate = (date) => new Date(date).toLocaleDateString();
const getTimestampFromId = (id) => new Date(Number((BigInt(id) >> 22n) + 1420070400000n));
const formatTimestamp = (id) => formatDate(getTimestampFromId(id));

function parseOptionalNumber(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCreatedDate(id) {
  return getTimestampFromId(id);
}

function formatUsername(user) {
  if (!user) return 'Unknown User';
  if (user.global_name) {
    return user.username ? `${user.global_name} (@${user.username})` : user.global_name;
  }
  if (user.username && user.discriminator && user.discriminator !== '0') {
    return `${user.username}#${user.discriminator}`;
  }
  return user.username ?? 'Unknown User';
}

async function removeFriend(token, userId, label, removeSpinner) {
  try {
    await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/relationships/${userId}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
    removeSpinner.succeed(`Removed ${label}`);
  } catch (error) {
    removeSpinner.fail(`Failed to remove ${label}: ${error.message}`);
  }
}

async function leaveGuild(token, guild, guildInfo, leaveSpinner) {
  try {
    await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/guilds/${guild}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
    leaveSpinner.succeed(`Left ${guildInfo.name}`);
  } catch (error) {
    leaveSpinner.fail(`Failed to leave ${guildInfo.name}: ${error.message}`);
  }
}

async function deleteGuild(token, guildInfo, twofactor, leaveSpinner) {
  try {
    await discordFetch(
      `${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/guilds/${guildInfo.id}/delete`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: twofactor ? JSON.stringify({ code: twofactor }) : null,
      }
    );
    leaveSpinner.succeed(`Successfully deleted ${guildInfo.name}`);
  } catch (error) {
    leaveSpinner.fail(`Failed to delete ${guildInfo.name}: ${error.message}`);
  }
}

async function main() {
  console.clear();
  const spinner = createSpinner();

  // Get and validate token
  const { value: token } = await prompts({
    type: "password",
    name: "value",
    message: "Enter your Discord token",
  });

  const tokenValidation = validateToken(token);
  if (!tokenValidation.valid) {
    spinner.fail(tokenValidation.error);
    process.exit(1);
  }

  spinner.start("Checking token");
  const tokenValid = await checkToken(token);
  if (!tokenValid.valid) {
    spinner.fail("Invalid token");
    process.exit(1);
  }
  spinner.succeed(`Token valid for ${tokenValid.username}#${tokenValid.discriminator}`);

  const { value: action } = await prompts({
    type: "select",
    name: "value",
    message: "What would you like to manage?",
    choices: [
      { title: "Servers (leave or delete)", value: "servers" },
      { title: "Friends list (remove friends)", value: "friends" },
    ],
  });

  if (!action) {
    spinner.fail("Operation cancelled");
    process.exit(1);
  }

  if (action === "friends") {
    spinner.start("Getting friends");
    const relationships = await getRelationships(token);
    if (!relationships.success) {
      spinner.fail(`Failed to get friends: ${relationships.error}`);
      process.exit(1);
    }

    const friends = relationships.data.filter((relationship) => relationship.type === 1);
    spinner.succeed(`Got ${friends.length} friends`);

    if (!friends.length) {
      spinner.fail("No friends found to remove");
      process.exit(1);
    }

    const { value: selectionMode } = await prompts({
      type: "select",
      name: "value",
      message: "How do you want to choose friends?",
      choices: [
        { title: "Select manually", value: "manual" },
        { title: `Remove all ${friends.length} friends`, value: "all" }
      ]
    });

    if (!selectionMode) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    let selectedFriends;
    if (selectionMode === "all") {
      selectedFriends = friends.map((friend) => friend.id);
    } else {
      const selectionResponse = await prompts({
        type: "multiselect",
        name: "value",
        message: "Select friends to remove",
        hint: "Space to select. Enter to confirm. Type to search.",
        instructions: false,
        choices: friends.map((friend) => ({
          title: formatUsername(friend.user),
          value: friend.id,
          description: friend.user?.id ?? ''
        })),
        onState: (state) => {
          if (state.aborted) {
            return true;
          }
        }
      });

      selectedFriends = selectionResponse.value;
    }

    if (selectedFriends === undefined) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    if (!selectedFriends?.length) {
      spinner.fail("No friends selected");
      process.exit(1);
    }

    const summary = `Selected ${selectedFriends.length} friends:
${selectedFriends.map((id, index) => {
  const friend = friends.find((entry) => entry.id === id);
  return `${index + 1}. ${formatUsername(friend?.user)}`;
}).join('\n')}`;

    const { value: confirmSelection } = await prompts({
      type: "confirm",
      name: "value",
      message: `${summary}\n\nAre you sure you want to proceed?`,
      initial: false
    });

    if (!confirmSelection) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    spinner.start(`Removing friends (0/${selectedFriends.length})`);
    let processedCount = 0;

    for (const friendId of selectedFriends) {
      const friend = friends.find((entry) => entry.id === friendId);
      const label = formatUsername(friend?.user);
      await removeFriend(token, friendId, label, spinner);
      processedCount++;
      spinner.text = `Removing friends (${processedCount}/${selectedFriends.length})`;
    }

    spinner.succeed("Friend cleanup completed successfully");
    return;
  }

  // Get and sort guilds
  spinner.start("Getting servers");
  const guilds = await getGuilds(token);
  if (!guilds.success) {
    spinner.fail(`Failed to get servers: ${guilds.error}`);
    process.exit(1);
  }

  // Enhance guild data with additional details
  const totalServers = guilds.data.length;
  let processedCount = 0;
  spinner.text = `Getting servers (0/${totalServers})`;
  
  for (let i = 0; i < guilds.data.length; i++) {
    guilds.data[i] = await enhanceGuildData(token, guilds.data[i]);
    processedCount++;
    spinner.text = `Getting servers (${processedCount}/${totalServers})`;
  }
  
  spinner.succeed(`Got ${guilds.data.length} servers`);

  let sortType;
  while (true) {
    // Sort servers
    const sortResponse = await prompts({
      type: "select",
      name: "value",
      message: "How do you want to sort the servers?",
      choices: [
        { title: "Name (A-Z)", value: "name" },
        { title: "Name (Z-A)", value: "name_reverse" },
        { title: "Join Date (Newest First)", value: "join_date_new" },
        { title: "Join Date (Oldest First)", value: "join_date_old" },
        { title: "Member Count (Highest First)", value: "members_high" },
        { title: "Member Count (Lowest First)", value: "members_low" },
        { title: "Server Age (Oldest First)", value: "server_age" },
        { title: "Your Role Count", value: "role_count" },
        { title: "Default Order", value: "default" },
      ],
    });

    if (!sortResponse.value) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    sortType = sortResponse.value;
    
    spinner.start("Sorting servers");
    let usedFallback = false;

    // Create a new sorted array instead of modifying the original
    const sortedGuilds = [...guilds.data].sort((a, b) => {
      switch (sortType) {
        case "name":
          return a.name.localeCompare(b.name);
        case "name_reverse":
          return b.name.localeCompare(a.name);
        case "join_date_new":
          if (!a.joined_at || !b.joined_at) usedFallback = true;
          const aDate = a.joined_at ? new Date(a.joined_at) : getTimestampFromId(a.id);
          const bDate = b.joined_at ? new Date(b.joined_at) : getTimestampFromId(b.id);
          return bDate - aDate;
        case "join_date_old":
          if (!a.joined_at || !b.joined_at) usedFallback = true;
          const aDateOld = a.joined_at ? new Date(a.joined_at) : getTimestampFromId(a.id);
          const bDateOld = b.joined_at ? new Date(b.joined_at) : getTimestampFromId(b.id);
          return aDateOld - bDateOld;
        case "members_high":
          if (!a.approximate_member_count || !b.approximate_member_count) usedFallback = true;
          return (b.approximate_member_count ?? 0) - (a.approximate_member_count ?? 0);
        case "members_low":
          if (!a.approximate_member_count || !b.approximate_member_count) usedFallback = true;
          return (a.approximate_member_count ?? 0) - (b.approximate_member_count ?? 0);
        case "server_age":
          return getTimestampFromId(a.id) - getTimestampFromId(b.id);
        case "role_count":
          if (!a.roles || !b.roles) usedFallback = true;
          return ((b.roles?.length ?? 0) - (a.roles?.length ?? 0));
        default:
          return 0;
      }
    });

    // Update the guilds.data with the sorted array
    guilds.data = sortedGuilds;

    const getSortStats = () => {
      switch (sortType) {
        case "members_high":
        case "members_low":
          const totalMembers = guilds.data.reduce((sum, g) => 
            sum + (g.approximate_member_count ?? 0), 0);
          const avgMembers = Math.round(totalMembers / guilds.data.length);
          return `Total members: ${totalMembers.toLocaleString()} | Average: ${avgMembers.toLocaleString()}`;
        case "role_count":
          const totalRoles = guilds.data.reduce((sum, g) => sum + (g.roles?.length ?? 0), 0);
          const avgRoles = Math.round(totalRoles / guilds.data.length);
          return `Total roles: ${totalRoles.toLocaleString()} | Average: ${avgRoles}`;
        case "server_age":
          const oldest = formatTimestamp(guilds.data[0].id);
          const newest = formatTimestamp(guilds.data[guilds.data.length - 1].id);
          return `Oldest: ${oldest} | Newest: ${newest}`;
        default:
          return '';
      }
    };

    const stats = getSortStats();
    spinner.succeed(`Sorted servers using ${sortType}${usedFallback ? ' (some data was missing, used fallback values)' : ''}${stats ? `\n${stats}` : ''}`);

    const { value: applyFilters } = await prompts({
      type: "confirm",
      name: "value",
      message: "Apply filters before selecting servers?",
      initial: false
    });

    if (applyFilters === undefined) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    let filteredGuilds = guilds.data;
    if (applyFilters) {
      const filterResponses = await prompts([
        {
          type: "select",
          name: "ownedFilter",
          message: "Filter owned servers",
          choices: [
            { title: "Include all", value: "any" },
            { title: "Only servers you own", value: "only" },
            { title: "Exclude servers you own", value: "exclude" }
          ],
          initial: 0
        },
        {
          type: "select",
          name: "adminFilter",
          message: "Filter servers where you have admin",
          choices: [
            { title: "Include all", value: "any" },
            { title: "Only servers with admin", value: "only" },
            { title: "Exclude servers with admin", value: "exclude" }
          ],
          initial: 0
        },
        {
          type: "select",
          name: "verifiedFilter",
          message: "Filter verified servers",
          choices: [
            { title: "Include all", value: "any" },
            { title: "Only verified servers", value: "only" }
          ],
          initial: 0
        },
        {
          type: "text",
          name: "minMembers",
          message: "Minimum member count (optional)",
          validate: (value) => {
            if (!value) return true;
            return Number.isNaN(Number(value)) ? "Enter a valid number" : true;
          }
        },
        {
          type: "text",
          name: "maxMembers",
          message: "Maximum member count (optional)",
          validate: (value) => {
            if (!value) return true;
            return Number.isNaN(Number(value)) ? "Enter a valid number" : true;
          }
        },
        {
          type: "text",
          name: "createdAfter",
          message: "Created after (YYYY-MM-DD, optional)",
          validate: (value) => {
            if (!value) return true;
            return parseOptionalDate(value) ? true : "Enter a valid date (YYYY-MM-DD)";
          }
        },
        {
          type: "text",
          name: "createdBefore",
          message: "Created before (YYYY-MM-DD, optional)",
          validate: (value) => {
            if (!value) return true;
            return parseOptionalDate(value) ? true : "Enter a valid date (YYYY-MM-DD)";
          }
        }
      ]);

      if (Object.values(filterResponses).some((value) => value === undefined)) {
        spinner.fail("Operation cancelled");
        process.exit(1);
      }

      const minMembers = parseOptionalNumber(filterResponses.minMembers);
      const maxMembers = parseOptionalNumber(filterResponses.maxMembers);
      const createdAfter = parseOptionalDate(filterResponses.createdAfter);
      const createdBefore = parseOptionalDate(filterResponses.createdBefore);

      filteredGuilds = guilds.data.filter((guild) => {
        const hasAdmin = (guild.permissions & 0x8) === 0x8;
        const isVerified = guild.features?.includes('VERIFIED');
        const memberCount = guild.approximate_member_count ?? 0;
        const createdAt = getCreatedDate(guild.id);

        if (filterResponses.ownedFilter === "only" && !guild.owner) return false;
        if (filterResponses.ownedFilter === "exclude" && guild.owner) return false;
        if (filterResponses.adminFilter === "only" && !hasAdmin) return false;
        if (filterResponses.adminFilter === "exclude" && hasAdmin) return false;
        if (filterResponses.verifiedFilter === "only" && !isVerified) return false;
        if (minMembers !== null && memberCount < minMembers) return false;
        if (maxMembers !== null && memberCount > maxMembers) return false;
        if (createdAfter && createdAt < createdAfter) return false;
        if (createdBefore && createdAt > createdBefore) return false;
        return true;
      });

      spinner.succeed(`Filters applied: ${filteredGuilds.length}/${guilds.data.length} servers match`);
    }

    if (!filteredGuilds.length) {
      spinner.fail("No servers match the selected filters");
      process.exit(1);
    }

    const { value: selectionMode } = await prompts({
      type: "select",
      name: "value",
      message: "How do you want to choose servers?",
      choices: [
        { title: "Select manually", value: "manual" },
        { title: `Leave all ${filteredGuilds.length} filtered servers`, value: "all" }
      ]
    });

    if (!selectionMode) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    let selectedGuilds;
    if (selectionMode === "all") {
      selectedGuilds = filteredGuilds.map((guild) => guild.id);
    } else {
      const selectionResponse = await prompts({
        type: "multiselect",
        name: "value",
        message: "Select servers to leave",
        hint: "Space to select. Enter to confirm. Type to search. Esc for different sorting",
        instructions: false,
        choices: filteredGuilds.map((guild) => {
          let details = [];
          
          // Add server age
          details.push(`Created: ${formatTimestamp(guild.id)}`);
          
          // Add join date if available
          if (guild.joined_at) {
            details.push(`Joined: ${formatDate(guild.joined_at)}`);
          }

          // Add member count if available
          if (guild.approximate_member_count) {
            details.push(`Members: ${guild.approximate_member_count.toLocaleString()}`);
          }

          // Add role count if available
          if (guild.roles?.length) {
            details.push(`Roles: ${guild.roles.length}`);
          }

          // Add status indicators
          const indicators = [];
          if (guild.owner) indicators.push('👑 Owner');
          if (guild.permissions & 0x8) indicators.push('⚡ Admin');
          if (guild.features?.includes('VERIFIED')) indicators.push('✓ Verified');
          if (indicators.length) details.push(indicators.join(' '));

          return {
            title: guild.name,
            value: guild.id,
            description: details.join(' | ')
          };
        }),
        onState: (state) => {
          if (state.aborted) {
            return true;
          }
        }
      });

      selectedGuilds = selectionResponse.value;
    }

    if (selectedGuilds === undefined) {
      continue;
    }

    if (!selectedGuilds?.length) {
      spinner.fail("No servers selected");
      process.exit(1);
    }

    // Show summary before confirmation
    const summary = `Selected ${selectedGuilds.length} servers:
${selectedGuilds.map((id, index) => {
  const guild = guilds.data.find(g => g.id === id);
  return `${index + 1}. ${guild.name} ${guild.owner ? '(You own this server)' : ''}`;
}).join('\n')}`;

    const { value: confirmSelection } = await prompts({
      type: "confirm",
      name: "value",
      message: `${summary}\n\nAre you sure you want to proceed?`,
      initial: false
    });

    if (!confirmSelection) {
      spinner.fail("Operation cancelled");
      process.exit(1);
    }

    // Process selected guilds
    spinner.start(`Processing servers (0/${selectedGuilds.length})`);
    let processedCount = 0;
    
    const user = await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me`, {
      headers: { Authorization: token },
    }).then(res => res.json());

    for (const guild of selectedGuilds) {
      try {
        const guildInfo = await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/guilds/${guild}`, {
          headers: { Authorization: token },
        }).then(res => res.json());

        if (guildInfo.owner_id !== user.id) {
          await leaveGuild(token, guild, guildInfo, spinner);
        } else {
          spinner.stop();
          const { value: deleteServer } = await prompts({
            type: "confirm",
            name: "value",
            message: `Do you want to delete ${guildInfo.name}?`,
          });

          if (deleteServer) {
            if (user.mfa_enabled) {
              const { value: twofactor } = await prompts({
                type: "text",
                name: "value",
                message: `Enter your 2FA code for ${guildInfo.name}`,
              });

              const tfaValidation = validate2FACode(twofactor);
              if (!tfaValidation.valid) {
                spinner.fail(tfaValidation.error);
                continue;
              }

              await deleteGuild(token, guildInfo, twofactor, spinner);
            } else {
              await deleteGuild(token, guildInfo, null, spinner);
            }
          }
        }
      } catch (error) {
        spinner.fail(`Failed to process server ${guild}: ${error.message}`);
      }

      processedCount++;
      spinner.text = `Processing servers (${processedCount}/${selectedGuilds.length})`;
    }

    spinner.succeed("Operation completed successfully");
    break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
