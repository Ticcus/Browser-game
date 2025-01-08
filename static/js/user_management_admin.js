document.addEventListener('DOMContentLoaded', function () {
  const searchBar = document.getElementById('search-bar');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const activeFilters = new Set();

  let sessionUserIsAdmin = false; 

  fetch('/get_user_status')
      .then(response => response.json())
      .then(data => {
          sessionUserIsAdmin = data.admin;
      })
      .catch(error => console.error('Error fetching user status:', error));

  filterButtons.forEach(button => {
      button.addEventListener('click', () => {
          const filterType = button.id.replace('filter-', '');

          if (filterType === 'all') {
              activeFilters.clear();
              filterButtons.forEach(btn => btn.classList.remove('active'));
              button.classList.add('active');
          } else {
              if (activeFilters.has(filterType)) {
                  activeFilters.delete(filterType);
                  button.classList.remove('active');
              } else {
                  activeFilters.add(filterType);
                  button.classList.add('active');
              }
              document.getElementById('filter-all').classList.remove('active');
          }
          searchUsers();
      });
  });

  searchBar.addEventListener('input', searchUsers);

  function searchUsers() {
      const query = searchBar.value;

      fetch(`/search_users?query=${query}`)
          .then(response => response.json())
          .then(users => {
              const userList = document.getElementById('user-list');
              userList.innerHTML = ''; 

              users.forEach(user => {
                  const [id, username, moderator, admin, banned] = user;

                  if (activeFilters.size > 0) {
                      let matchesFilter = false;

                      if (activeFilters.has('admin') && admin === 1) matchesFilter = true;
                      if (activeFilters.has('moderator') && moderator === 1) matchesFilter = true;
                      if (activeFilters.has('banned') && banned === 1) matchesFilter = true;
                      if (activeFilters.has('players') && !admin && !moderator && !banned)
                          matchesFilter = true;

                      if (!matchesFilter) return;
                  }

                  const userItem = document.createElement('div');
                  userItem.classList.add('user-item');

                  const roleControls = admin === 1 && sessionUserIsAdmin
                      ? '<div><span>Admin role</span></div>'
                      : `
                        <label>Moderator: </label>
                        <input type="range" class="slider" min="0" max="1" value="${moderator}" 
                               onchange="updateUserRole(${id}, 'moderator', this.value)" />
                        <button onclick="banUser(${id}, ${banned === 1 ? 0 : 1})">
                          ${banned === 1 ? 'Unban' : 'Ban'}
                        </button>
                        <button onclick="deleteUser(${id})">Delete</button>
                      `;

                  userItem.innerHTML = `
                    <div>${username}</div>
                    <div>${roleControls}</div>
                  `;
                  userList.appendChild(userItem);
              });
          });
  }

  window.updateUserRole = function (userId, role, value) {
      const data = { user_id: userId, [role]: parseInt(value, 10) };

      fetch('/update_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
      })
          .then(response => response.json())
          .then(data => {
              alert(data.message);
              searchUsers();
          });
  };

  window.banUser = function (userId, banStatus) {
      fetch('/update_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, ban: banStatus }),
      })
          .then(response => response.json())
          .then(data => {
              alert(data.message);
              searchUsers();
          });
  };

  window.deleteUser = function (userId) {
      fetch('/delete_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
      })
          .then(response => response.json())
          .then(data => {
              alert(data.message);
              searchUsers();
          });
  };

  searchUsers();
});
